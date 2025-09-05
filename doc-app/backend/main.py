from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import load_dotenv
from groq import Groq
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models import ChatMessage, User, Document, get_engine
from sqlalchemy.orm import sessionmaker
import requests
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import logging
import uvicorn
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from mangum import Mangum

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer(auto_error=False)

class AgentRequest(BaseModel):
    query: str
    action: Optional[str] = None

class ChatRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = "default_session"

class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class DocumentCreate(BaseModel):
    title: str
    content: Optional[str] = ""

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

app = FastAPI(title="Doc App API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client with error handling
try:
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        logger.warning("GROQ_API_KEY environment variable not set - AI features will be limited")
        groq_client = None
    else:
        groq_client = Groq(api_key=groq_api_key)
        logger.info("Groq client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Groq client: {e}")
    groq_client = None

# Database session with improved error handling
def get_db():
    db = None
    try:
        engine = get_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        yield db
        
    except SQLAlchemyError as e:
        logger.error(f"Database connection error: {e}")
        if db:
            db.rollback()
        raise HTTPException(status_code=503, detail="Database connection failed")
        
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions without logging as database errors
        if db:
            db.rollback()
        raise http_ex
        
    except Exception as e:
        logger.error(f"Unexpected database session error: {e}")
        if db:
            db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error")
        
    finally:
        if db:
            try:
                db.close()
            except Exception as e:
                logger.error(f"Error closing database session: {e}")

# Authentication functions with modern datetime
def hash_password(password: str) -> str:
    """Hash a password using SHA-256 (in production, use bcrypt)"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return hashlib.sha256(password.encode()).hexdigest() == hashed

def create_jwt_token(user_id: int, email: str) -> str:
    """Create JWT token for user with modern datetime"""
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT configuration error")
    
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": now
    }
    
    try:
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info(f"Created JWT token for user {user_id} (expires: {payload['exp']})")
        return token
    except Exception as e:
        logger.error(f"Failed to create JWT token: {e}")
        raise HTTPException(status_code=500, detail="Token creation failed")

def verify_jwt_token(token: str) -> Dict[str, Any]:
    """Verify JWT token and return payload"""
    if not token:
        logger.warning("Empty token provided")
        raise HTTPException(status_code=401, detail="Token is required")
    
    if not JWT_SECRET:
        logger.error("JWT_SECRET not configured")
        raise HTTPException(status_code=500, detail="Authentication service not configured")
    
    try:
        # Decode and verify the token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        logger.debug(f"Successfully verified token for user {payload.get('user_id')}")
        return payload
        
    except jwt.ExpiredSignatureError:
        exp_time = None
        try:
            # Get expiration time from expired token for better error message
            unverified = jwt.decode(token, options={"verify_signature": False})
            exp_time = datetime.fromtimestamp(unverified.get('exp', 0))
        except:
            pass
        
        logger.warning(f"Token has expired (expired at: {exp_time})")
        raise HTTPException(status_code=401, detail="Token has expired")
        
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
        
    except Exception as e:
        logger.error(f"JWT verification error: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), 
    db: Session = Depends(get_db)
) -> User:
    """Get current user from JWT token"""
    
    # Check if credentials were provided
    if not credentials:
        logger.warning("No authorization credentials provided")
        raise HTTPException(
            status_code=401, 
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Verify the token
        payload = verify_jwt_token(credentials.credentials)
        
        # Get user from database
        user = db.query(User).filter(User.id == payload["user_id"]).first()
        if not user:
            logger.warning(f"User not found for token user_id: {payload.get('user_id')}")
            raise HTTPException(status_code=401, detail="User not found")
        
        logger.debug(f"Successfully authenticated user: {user.email}")
        return user
        
    except HTTPException:
        # Re-raise HTTP exceptions (these are already properly formatted)
        raise
        
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

# Debug middleware to help identify authentication issues
@app.middleware("http")
async def debug_auth_middleware(request: Request, call_next):
    """Debug middleware to log authentication details"""
    
    # Only log for API endpoints that require auth
    protected_paths = ["/api/documents", "/api/chat", "/api/agent", "/api/auth/me"]
    is_protected = any(request.url.path.startswith(path) for path in protected_paths)
    
    if is_protected:
        logger.info(f"=== Auth Debug: {request.method} {request.url.path} ===")
        
        # Check authorization header
        auth_header = request.headers.get("authorization")
        if auth_header:
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]  # Remove "Bearer " prefix
                logger.info(f"Token present: Yes (length: {len(token)})")
                
                # Try to decode without verification to see token structure
                try:
                    unverified = jwt.decode(token, options={"verify_signature": False})
                    logger.info(f"Token user_id: {unverified.get('user_id')}")
                    logger.info(f"Token email: {unverified.get('email')}")
                    
                    # Check if token is expired
                    if unverified.get('exp'):
                        exp_time = datetime.fromtimestamp(unverified['exp'])
                        now = datetime.now(timezone.utc)
                        is_expired = now > exp_time
                        logger.info(f"Token expired: {is_expired}")
                        if is_expired:
                            logger.warning(f"Token expired at: {exp_time}, current time: {now}")
                        
                except Exception as e:
                    logger.error(f"Failed to decode token structure: {e}")
            else:
                logger.warning(f"Invalid auth header format: {auth_header[:30]}...")
        else:
            logger.warning("No authorization header found")
        
        logger.info("=== End Auth Debug ===")
    
    try:
        response = await call_next(request)
        return response
    except HTTPException as http_ex:
        if is_protected:
            logger.error(f"HTTP Exception in protected route: {http_ex.status_code} - {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error in request processing: {e}")
        raise

# Web search functions (existing code)
async def search_duckduckgo(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    """Search using DuckDuckGo Instant Answer API"""
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://api.duckduckgo.com/"
            params = {
                'q': query,
                'format': 'json',
                'pretty': 1,
                'no_redirect': 1,
                'no_html': 1,
                'skip_disambig': 1
            }
            
            async with session.get(url, params=params, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    
                    related_topics = data.get('RelatedTopics', [])
                    for topic in related_topics[:num_results]:
                        if isinstance(topic, dict) and 'Text' in topic:
                            results.append({
                                'title': topic.get('Text', '').split(' - ')[0],
                                'url': topic.get('FirstURL', ''),
                                'snippet': topic.get('Text', '')
                            })
                    
                    if not results and data.get('Abstract'):
                        results.append({
                            'title': f"About {query}",
                            'url': data.get('AbstractURL', ''),
                            'snippet': data.get('Abstract', '')
                        })
                    
                    return results
    except Exception as e:
        logger.error(f"DuckDuckGo search error: {e}")
    
    return []

async def search_serper(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    """Search using Serper API (if API key is available)"""
    api_key = os.getenv("SERPER_API_KEY")
    if not api_key:
        return []
    
    try:
        async with aiohttp.ClientSession() as session:
            url = "https://google.serper.dev/search"
            headers = {
                'X-API-KEY': api_key,
                'Content-Type': 'application/json'
            }
            payload = {
                'q': query,
                'num': num_results
            }
            
            async with session.post(url, json=payload, headers=headers, timeout=10) as response:
                if response.status == 200:
                    data = await response.json()
                    results = []
                    
                    for item in data.get('organic', []):
                        results.append({
                            'title': item.get('title', ''),
                            'url': item.get('link', ''),
                            'snippet': item.get('snippet', '')
                        })
                    
                    return results
    except Exception as e:
        logger.error(f"Serper search error: {e}")
    
    return []

async def search_web(query: str, num_results: int = 5) -> List[Dict[str, Any]]:
    """Perform web search using available APIs"""
    results = []
    
    # Try Serper first (more reliable if API key available)
    if os.getenv("SERPER_API_KEY"):
        results = await search_serper(query, num_results)
        if results:
            logger.info(f"Found {len(results)} results using Serper API")
            return results
    
    # Fallback to DuckDuckGo
    results = await search_duckduckgo(query, num_results)
    if results:
        logger.info(f"Found {len(results)} results using DuckDuckGo")
        return results
    
    # If no results, return mock data (for testing)
    logger.warning("No web search results found, returning mock data")
    return [
        {
            "title": f"Mock Result for: {query}",
            "url": f"https://example.com/search?q={query.replace(' ', '+')}",
            "snippet": f"This is a mock search result for '{query}'. To get real results, configure SERPER_API_KEY environment variable."
        }
    ]

async def crawl_url(url: str) -> str:
    """Crawl content from a URL"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=30) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Remove script and style elements
                    for script in soup(["script", "style"]):
                        script.decompose()
                    
                    # Extract text content
                    text = soup.get_text()
                    
                    # Clean up whitespace
                    lines = (line.strip() for line in text.splitlines())
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    text = ' '.join(chunk for chunk in chunks if chunk)
                    
                    # Limit length
                    return text[:2000] + "..." if len(text) > 2000 else text
                else:
                    return f"Error: Unable to access URL (Status: {response.status})"
    except Exception as e:
        logger.error(f"URL crawling error: {e}")
        return f"Error: Unable to crawl URL - {str(e)}"

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("Starting Doc App API...")
    
    # Test database connection
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful")
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        logger.warning("Application will continue but database features may not work")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Doc App API is running",
        "status": "healthy",
        "version": "1.0.0",
        "features": ["auth", "chat", "web_search", "url_crawling", "documents"]
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    health_status = {
        "api": "healthy",
        "database": "unknown",
        "groq": "unknown",
        "search": "unknown"
    }
    
    # Check database
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health_status["database"] = "healthy"
    except Exception as e:
        health_status["database"] = f"unhealthy: {str(e)}"
    
    # Check Groq
    if groq_client:
        health_status["groq"] = "configured"
    else:
        health_status["groq"] = "not configured"
    
    # Check search capabilities
    search_apis = []
    if os.getenv("SERPER_API_KEY"):
        search_apis.append("serper")
    search_apis.append("duckduckgo")
    health_status["search"] = f"available: {', '.join(search_apis)}"
    
    return health_status

# Test endpoint to verify JWT functionality
@app.get("/api/debug/token-test")
async def test_token_creation():
    """Test endpoint to create and verify a token"""
    if not JWT_SECRET:
        return {"error": "JWT_SECRET not configured"}
    
    try:
        # Create a test token
        test_token = create_jwt_token(999, "test@example.com")
        
        # Verify the token
        payload = verify_jwt_token(test_token)
        
        return {
            "status": "success",
            "message": "JWT token creation and verification working",
            "test_token": test_token,  # Show full token for debugging
            "token_length": len(test_token),
            "token_segments": len(test_token.split('.')),
            "payload": payload
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

# Debug endpoint to inspect incoming requests
@app.post("/api/debug/inspect-headers")
async def inspect_headers(request: Request):
    """Debug endpoint to inspect request headers"""
    auth_header = request.headers.get("authorization", "")
    
    return {
        "all_headers": dict(request.headers),
        "authorization_header": auth_header,
        "authorization_length": len(auth_header),
        "has_bearer_prefix": auth_header.startswith("Bearer "),
        "token_after_bearer": auth_header[7:] if auth_header.startswith("Bearer ") else "",
        "token_segments": len(auth_header[7:].split('.')) if auth_header.startswith("Bearer ") else 0
    }

# Authentication endpoints
@app.post("/api/auth/register")
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        hashed_password = hash_password(user_data.password)
        new_user = User(
            name=user_data.name,
            email=user_data.email,
            password_hash=hashed_password
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create JWT token
        token = create_jwt_token(new_user.id, new_user.email)
        
        return {
            "token": token,
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email
            },
            "status": "success"
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error during registration: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login")
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    try:
        # Find user
        user = db.query(User).filter(User.email == login_data.email).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Verify password
        if not verify_password(login_data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Create JWT token
        token = create_jwt_token(user.id, user.email)
        
        return {
            "token": token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email
            },
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email
        }
    }

# Document endpoints
@app.post("/api/documents")
async def create_document(
    doc_data: DocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new document"""
    try:
        new_doc = Document(
            title=doc_data.title,
            content=doc_data.content,
            owner_id=current_user.id
        )
        
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        
        return {
            "document": {
                "id": new_doc.id,
                "title": new_doc.title,
                "content": new_doc.content,
                "created_at": new_doc.created_at.isoformat(),
                "updated_at": new_doc.updated_at.isoformat()
            },
            "status": "success"
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error creating document: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create document")

@app.get("/api/documents")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's documents"""
    try:
        documents = db.query(Document).filter(Document.owner_id == current_user.id).all()
        
        return {
            "documents": [
                {
                    "id": doc.id,
                    "title": doc.title,
                    "created_at": doc.created_at.isoformat(),
                    "updated_at": doc.updated_at.isoformat()
                }
                for doc in documents
            ],
            "total": len(documents)
        }
        
    except SQLAlchemyError as e:
        logger.error(f"Database error listing documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to list documents")

@app.get("/api/documents/{document_id}")
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific document"""
    try:
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "document": {
                "id": document.id,
                "title": document.title,
                "content": document.content,
                "created_at": document.created_at.isoformat(),
                "updated_at": document.updated_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error getting document: {e}")
        raise HTTPException(status_code=500, detail="Failed to get document")

@app.put("/api/documents/{document_id}")
async def update_document(
    document_id: int,
    doc_data: DocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a document"""
    try:
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Update fields
        if doc_data.title is not None:
            document.title = doc_data.title
        if doc_data.content is not None:
            document.content = doc_data.content
        
        db.commit()
        db.refresh(document)
        
        return {
            "document": {
                "id": document.id,
                "title": document.title,
                "content": document.content,
                "created_at": document.created_at.isoformat(),
                "updated_at": document.updated_at.isoformat()
            },
            "status": "success"
        }
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error updating document: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update document")

@app.delete("/api/documents/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    try:
        document = db.query(Document).filter(
            Document.id == document_id,
            Document.owner_id == current_user.id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        db.delete(document)
        db.commit()
        
        return {"status": "success", "message": "Document deleted"}
        
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        logger.error(f"Database error deleting document: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete document")

# Agent and chat endpoints (with authentication)
@app.post("/api/agent")
async def agent_command(
    request: AgentRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint for agent commands including web search and URL crawling
    """
    try:
        if request.action == "web_search":
            # Perform actual web search
            results = await search_web(request.query, num_results=5)
            
            response_data = {
                "query": request.query,
                "results": results,
                "summary": f"Found {len(results)} results for: {request.query}",
                "total_results": len(results),
                "timestamp": str(asyncio.get_event_loop().time())
            }
            
            try:
                # Store search query in database
                db_message = ChatMessage(
                    session_id=f"user_{current_user.id}_agent",
                    role="agent",
                    content=f"Web search: {request.query} - Found {len(results)} results"
                )
                db.add(db_message)
                db.commit()
                logger.info(f"Stored agent search query: {request.query} for user {current_user.id}")
            except SQLAlchemyError as e:
                logger.error(f"Failed to store agent message: {e}")
                # Don't fail the request if database storage fails
            
            return {"result": response_data, "status": "success"}
            
        elif request.action == "crawl_url":
            # Crawl URL content
            content = await crawl_url(request.query)
            
            response_data = {
                "url": request.query,
                "content": content,
                "timestamp": str(asyncio.get_event_loop().time())
            }
            
            try:
                # Store crawl result in database
                db_message = ChatMessage(
                    session_id=f"user_{current_user.id}_agent",
                    role="agent",
                    content=f"URL crawl: {request.query} - {len(content)} characters"
                )
                db.add(db_message)
                db.commit()
                logger.info(f"Stored agent crawl result: {request.query} for user {current_user.id}")
            except SQLAlchemyError as e:
                logger.error(f"Failed to store agent message: {e}")
            
            return {"result": response_data, "status": "success"}
            
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unsupported agent action: {request.action}. Supported actions: web_search, crawl_url"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Agent command error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/chat")
async def chat_completion(
    request: ChatRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Endpoint for chat completions using Groq API (with authentication)
    """
    if not groq_client:
        raise HTTPException(
            status_code=503, 
            detail="AI service not configured. Please contact administrator."
        )
    
    try:
        # Validate input
        if not request.prompt or not request.prompt.strip():
            raise HTTPException(status_code=400, detail="Prompt cannot be empty")
        
        # Use user-specific session ID
        user_session_id = f"user_{current_user.id}_{request.session_id}"
        
        # Create chat completion
        completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": request.prompt}],
            model="meta-llama/llama-4-maverick-17b-128e-instruct",  # Using a more stable model
            temperature=0.7,
            max_tokens=1000
        )
        
        response_content = completion.choices[0].message.content
        
        try:
            # Store user message in database
            user_message = ChatMessage(
                session_id=user_session_id,
                role="user",
                content=request.prompt
            )
            db.add(user_message)
            
            # Store assistant response
            assistant_message = ChatMessage(
                session_id=user_session_id,
                role="assistant",
                content=response_content
            )
            db.add(assistant_message)
            db.commit()
            
            logger.info(f"Stored chat messages for user {current_user.id}, session: {user_session_id}")
            
        except SQLAlchemyError as e:
            logger.error(f"Failed to store chat messages: {e}")
            # Don't fail the request if database storage fails
        
        return {
            "response": response_content,
            "session_id": request.session_id,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Chat completion error: {e}")
        if "API key" in str(e):
            raise HTTPException(status_code=401, detail="AI service authentication failed")
        elif "model" in str(e).lower():
            raise HTTPException(status_code=400, detail=f"AI model error: {str(e)}")
        else:
            raise HTTPException(status_code=500, detail="AI service temporarily unavailable")

@app.get("/api/chat/history/{session_id}")
async def get_chat_history(
    session_id: str, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for a specific session (user-specific)"""
    try:
        user_session_id = f"user_{current_user.id}_{session_id}"
        messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == user_session_id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        return {
            "session_id": session_id,
            "messages": [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in messages
            ],
            "total": len(messages)
        }
    except SQLAlchemyError as e:
        logger.error(f"Failed to retrieve chat history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chat history")

"""
if __name__ == "__main__":
    # Run the application
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
    """
handler = Mangum(app)