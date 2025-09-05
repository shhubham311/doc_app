# Doc-App: AI-Powered Document Assistant

An intelligent document processing and chat application that combines AI capabilities with web search and editor integration. Built with Next.js frontend and FastAPI backend.

## 🚀 Features

- **AI Chat Interface**: Natural language conversations with AI assistance
- **Web Search Integration**: Real-time web search capabilities
- **Document Editor**: Built-in text editor with AI-powered improvements
- **Session Management**: Persistent chat sessions and history
- **Real-time Updates**: Live connection status monitoring
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), SQLAlchemy, SQLite
- **AI Integration**: OpenAI API integration
- **Database**: SQLite with Alembic migrations

### Project Structure
```
doc-app/
├── frontend/ (Next.js)
│   ├── src/app/          # App router pages
│   ├── components/       # React components
│   └── public/          # Static assets
├── backend/ (FastAPI)
│   ├── main.py          # FastAPI application
│   ├── models.py        # Database models
│   ├── alembic/         # Database migrations
│   └── requirements.txt # Python dependencies
└── README.md
```

## 🛠️ Getting Started

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.8+ and **pip**
- **Git** for version control

### Installation

#### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd doc-app
```

#### 2. Backend Setup

Navigate to the backend directory:
```bash
cd doc-app/backend
```

Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your OpenAI API key and other settings
```

Initialize the database:
```bash
alembic upgrade head
```

#### 3. Frontend Setup

Navigate to the frontend directory:
```bash
cd doc-app
```

Install dependencies:
```bash
npm install
```

Create environment file:
```bash
cp .env.example .env.local
# Edit .env.local with your backend URL
```

## 🚀 Running the Application

### Development Mode

#### Start the Backend
```bash
cd doc-app/backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```
The backend will run on http://localhost:8000

#### Start the Frontend
In a new terminal:
```bash
cd doc-app
npm run dev
```
The frontend will run on http://localhost:3000

### Production Build

#### Backend Production
```bash
cd doc-app/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### Frontend Production
```bash
cd doc-app
npm run build
npm start
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=sqlite:///./docapp.db

# Server
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# CORS
CORS_ORIGINS=["http://localhost:3000", "http://localhost:3001"]
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 📖 Usage

### Basic Workflow

1. **Start the Application**: Run both backend and frontend servers
2. **Access the Interface**: Open http://localhost:3000 in your browser
3. **Chat with AI**: Use the sidebar to start conversations
4. **Web Search**: Ask questions that require web search
5. **Editor Integration**: Use AI to improve selected text

### Chat Features

- **Natural Language**: Ask questions in plain English
- **Web Search**: Prefix queries with "search" or "find" for web results
- **Editor Actions**: Use "improve" or "insert" for document editing
- **Session History**: All conversations are saved automatically

### Editor Integration

1. **Text Selection**: Select text in the editor
2. **AI Actions**: Use the floating toolbar for AI improvements
3. **Search Results**: Insert web search results directly into documents
4. **Real-time Updates**: See changes reflected immediately

## 🔍 API Documentation

### Backend Endpoints

#### Chat Endpoints
- `POST /api/chat` - Send chat messages
- `GET /api/chat/history/{session_id}` - Get chat history
- `DELETE /api/chat/session/{session_id}` - Delete session

#### Search Endpoints
- `POST /api/search` - Perform web search
- `GET /api/search/history` - Get search history

#### Health Check
- `GET /health` - Server health status
- `GET /ready` - Readiness probe

### WebSocket Support
Real-time chat updates via WebSocket at `/ws/{session_id}`

## 🧪 Development

### Code Style
- **Frontend**: ESLint + Prettier
- **Backend**: Black + isort + flake8

### Testing
```bash
# Frontend tests
npm test

# Backend tests
cd backend
python -m pytest
```

### Database Migrations
```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## 🐛 Troubleshooting

### Common Issues

#### Connection Issues
- **Backend not starting**: Check if port 8000 is available
- **Frontend connection errors**: Verify backend URL in .env.local
- **CORS errors**: Check CORS_ORIGINS in backend .env

#### Database Issues
- **Database locked**: Ensure no other processes are using SQLite
- **Migration errors**: Run `alembic upgrade head` from backend directory

#### AI Issues
- **API key errors**: Verify OpenAI API key in backend .env
- **Rate limiting**: Check OpenAI usage limits

### Debug Mode
Enable debug logging by setting:
```bash
export DEBUG=true  # Linux/Mac
set DEBUG=true     # Windows
```

## 📄 Contributing

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test both frontend and backend



## 🗺️ Roadmap

- [ ] **Voice Input**: Speech-to-text integration
- [ ] **Document Export**: PDF, DOCX export options
- [ ] **Collaboration**: Real-time collaborative editing
- [ ] **Advanced Search**: Image search, file search
- [ ] **Plugins**: Extensible plugin system
- [ ] **Mobile App**: React Native mobile version

---

