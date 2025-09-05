//import Image from "next/image";
import Editor from './components/Editor';
import ChatSidebar from './components/ChatSidebar';
import AuthLayout from './components/AuthLayout';

export default function Home() {
  return (
    <AuthLayout>
      <div className="h-screen flex overflow-hidden bg-gray-50">
        {/* Main editor area */}
        <div className="flex-1">
          <Editor />
        </div>
        
        {/* Chat sidebar */}
        <ChatSidebar />
      </div>
    </AuthLayout>
  );
}