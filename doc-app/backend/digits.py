#!/usr/bin/env python3
"""
Simple script to test JWT functionality with your exact configuration
Run this to verify JWT is working correctly
"""

import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

def test_jwt():
    print("=== JWT Configuration Test ===")
    print(f"JWT_SECRET set: {bool(JWT_SECRET)}")
    print(f"JWT_SECRET length: {len(JWT_SECRET) if JWT_SECRET else 0}")
    print(f"JWT_ALGORITHM: {JWT_ALGORITHM}")
    print(f"JWT_EXPIRATION_HOURS: {JWT_EXPIRATION_HOURS}")
    
    if not JWT_SECRET:
        print("❌ JWT_SECRET not found in environment variables")
        return False
    
    try:
        # Create a test token
        payload = {
            "user_id": 123,
            "email": "test@example.com",
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
            "iat": datetime.utcnow()
        }
        
        print(f"\n=== Creating Token ===")
        print(f"Payload: {payload}")
        
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        print(f"✅ Token created successfully")
        print(f"Token (first 50 chars): {token[:50]}...")
        
        # Verify the token
        print(f"\n=== Verifying Token ===")
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        print(f"✅ Token verified successfully")
        print(f"Decoded payload: {decoded}")
        
        # Test with PyJWT version info
        print(f"\n=== PyJWT Version Info ===")
        print(f"PyJWT version: {jwt.__version__}")
        
        return True
        
    except Exception as e:
        print(f"❌ JWT test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_jwt()
    if success:
        print("\n✅ All JWT tests passed!")
    else:
        print("\n❌ JWT tests failed!")