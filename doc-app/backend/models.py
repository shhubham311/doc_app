from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
import os
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user', 'assistant', or 'agent'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<ChatMessage(id={self.id}, session_id='{self.session_id}', role='{self.role}')>"

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', name='{self.name}')>"

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    owner_id = Column(Integer, nullable=False)  # Foreign key to users
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<Document(id={self.id}, title='{self.title}', owner_id={self.owner_id})>"

def get_database_url():
    """Get database URL with SQLite fallback for development"""
    # Try different environment variable names
    database_url = (
        os.getenv("DATABASE_URL") or 
        os.getenv("DB_URL") or 
        os.getenv("POSTGRES_URL")
    )
    
    if database_url:
        # Fix postgres:// to postgresql:// if needed
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        return database_url
    
    # Check if PostgreSQL connection is possible
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "docapp")
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "postgres")
    
    # Try PostgreSQL first
    postgres_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    # Test PostgreSQL connection
    try:
        test_engine = create_engine(postgres_url, pool_pre_ping=True)
        with test_engine.connect() as conn:
            # Fixed: Use text() wrapper for raw SQL
            conn.execute(text("SELECT 1"))
        logger.info("PostgreSQL connection successful")
        return postgres_url
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed: {e}")
        logger.info("Falling back to SQLite database")
        
        # Fallback to SQLite
        sqlite_path = os.getenv("SQLITE_DB_PATH", "docapp.db")
        return f"sqlite:///{sqlite_path}"

def get_engine():
    """Create and return database engine with error handling"""
    database_url = get_database_url()
    
    try:
        # Different settings based on database type
        if database_url.startswith("sqlite"):
            # SQLite-specific settings
            engine = create_engine(
                database_url,
                echo=os.getenv("DB_ECHO", "false").lower() == "true",
                connect_args={"check_same_thread": False}  # Required for SQLite with FastAPI
            )
            logger.info("Using SQLite database")
        else:
            # PostgreSQL/other database settings
            engine = create_engine(
                database_url,
                pool_size=5,
                pool_timeout=30,
                pool_recycle=1800,  # Recycle connections every 30 minutes
                pool_pre_ping=True,  # Verify connections before use
                echo=os.getenv("DB_ECHO", "false").lower() == "true"  # Enable SQL logging if needed
            )
            logger.info("Using PostgreSQL database")
        
        return engine
        
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        logger.error(f"Database URL pattern: {database_url}")
        raise

def create_tables():
    """Create all tables if they don't exist"""
    try:
        engine = get_engine()
        Base.metadata.create_all(engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

def test_connection():
    """Test database connection"""
    try:
        engine = get_engine()
        with engine.connect() as connection:
            # Fixed: Use text() wrapper for raw SQL
            result = connection.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            if row and row[0] == 1:
                logger.info("Database connection test successful")
                return True
            else:
                logger.error("Database connection test failed: unexpected result")
                return False
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False

# Only create tables if this file is run directly or if tables don't exist
if __name__ == "__main__":
    # Test connection first
    if test_connection():
        create_tables()
        print("Database setup completed successfully")
    else:
        print("Database connection failed. Please check your configuration.")
        print("\nFor PostgreSQL:")
        print("- DATABASE_URL (full connection string) OR")
        print("- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
        print("\nFor SQLite fallback:")
        print("- SQLITE_DB_PATH (optional, defaults to docapp.db)")
        print("\nCurrent configuration:")
        print(f"Database URL: {get_database_url()}")
else:
    # Try to create tables when imported, but don't fail if it doesn't work
    try:
        create_tables()
    except Exception as e:
        logger.warning(f"Could not create tables on import: {e}")
        logger.info("Tables will be created when the database is available")