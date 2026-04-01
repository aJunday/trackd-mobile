#!/usr/bin/env python3
"""
Backend API Testing Script for Goal Calibration and Nutrition APIs
Tests the new endpoints at https://fitness-command-7.preview.emergentagent.com
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"
session_token = None
user_id = None

def print_test_result(test_name, success, details=""):
    """Print formatted test result."""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"    {details}")
    print()

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request with proper error handling."""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {}
    
    if session_token:
        headers["Authorization"] = f"Bearer {session_token}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=30)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def test_user_goals_endpoints():
    """Test all user goals endpoints."""
    print("=== TESTING USER GOALS ENDPOINTS ===\n")
    
    # Test 1: Update user goals
    print("1. Testing PUT /api/users/goals")
    goals_data = {
        "goal_calories": 2500,
        "goal_protein": 180,
        "goal_carbs": 280,
        "goal_fats": 80
    }
    
    response = make_request("PUT", "/users/goals", goals_data)
    if response and response.status_code == 200:
        data = response.json()
        if data.get("goal_calories") == 2500:
            print_test_result("Update user goals", True, f"Goals updated successfully: {data.get('goal_calories')} calories")
        else:
            print_test_result("Update user goals", False, f"Goals not updated correctly: {data}")
    else:
        print_test_result("Update user goals", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Calculate TDEE
    print("2. Testing POST /api/users/calculate-tdee")
    tdee_data = {
        "weight": 75.0,
        "height": 175.0,
        "age": 28,
        "gender": "male",
        "activity_level": "moderate"
    }
    
    response = make_request("POST", "/users/calculate-tdee", tdee_data)
    if response and response.status_code == 200:
        data = response.json()
        if "tdee" in data and "presets" in data:
            print_test_result("Calculate TDEE", True, f"TDEE: {data['tdee']}, Presets available: {list(data['presets'].keys())}")
        else:
            print_test_result("Calculate TDEE", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Calculate TDEE", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: Apply cutting preset
    print("3. Testing POST /api/users/apply-preset/cutting")
    response = make_request("POST", "/users/apply-preset/cutting")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "cutting":
            print_test_result("Apply cutting preset", True, f"Cutting preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply cutting preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply cutting preset", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Apply maintenance preset
    print("4. Testing POST /api/users/apply-preset/maintenance")
    response = make_request("POST", "/users/apply-preset/maintenance")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "maintenance":
            print_test_result("Apply maintenance preset", True, f"Maintenance preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply maintenance preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply maintenance preset", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 5: Apply bulking preset
    print("5. Testing POST /api/users/apply-preset/bulking")
    response = make_request("POST", "/users/apply-preset/bulking")
    if response and response.status_code == 200:
        data = response.json()
        if "goals" in data and data["goals"].get("goal_type") == "bulking":
            print_test_result("Apply bulking preset", True, f"Bulking preset applied: {data['goals']['goal_calories']} calories")
        else:
            print_test_result("Apply bulking preset", False, f"Preset not applied correctly: {data}")
    else:
        print_test_result("Apply bulking preset", False, f"Status: {response.status_code if response else 'No response'}")

def test_nutrition_endpoints():
    """Test all nutrition endpoints."""
    print("=== TESTING NUTRITION ENDPOINTS ===\n")
    
    # Test 1: Get today's nutrition (should be empty initially)
    print("1. Testing GET /api/nutrition/today (initial)")
    response = make_request("GET", "/nutrition/today")
    if response and response.status_code == 200:
        data = response.json()
        if "consumed" in data and "goals" in data:
            print_test_result("Get today's nutrition (initial)", True, f"Consumed: {data['consumed']['calories']} calories, Goals: {data['goals']['calories']} calories")
        else:
            print_test_result("Get today's nutrition (initial)", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Get today's nutrition (initial)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 2: Get meals for today (should be empty initially)
    print("2. Testing GET /api/nutrition/meals (initial)")
    response = make_request("GET", "/nutrition/meals")
    if response and response.status_code == 200:
        data = response.json()
        if "meals" in data and "date" in data:
            print_test_result("Get meals (initial)", True, f"Found {len(data['meals'])} meals for {data['date']}")
        else:
            print_test_result("Get meals (initial)", False, f"Missing expected fields: {data}")
    else:
        print_test_result("Get meals (initial)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 3: Log a new meal
    print("3. Testing POST /api/nutrition/meals")
    meal_data = {
        "meal_type": "lunch",
        "items": [
            {
                "name": "Chicken Breast",
                "calories": 165,
                "protein": 31,
                "carbs": 0,
                "fats": 3.6,
                "quantity": 1,
                "unit": "serving"
            },
            {
                "name": "Rice",
                "calories": 200,
                "protein": 4,
                "carbs": 45,
                "fats": 0.5,
                "quantity": 1,
                "unit": "cup"
            }
        ]
    }
    
    response = make_request("POST", "/nutrition/meals", meal_data)
    meal_id = None
    if response and response.status_code == 200:
        data = response.json()
        meal_id = data.get("meal_id")
        if meal_id and data.get("total_calories") == 365:
            print_test_result("Log new meal", True, f"Meal logged: {data['total_calories']} calories, ID: {meal_id}")
        else:
            print_test_result("Log new meal", False, f"Meal not logged correctly: {data}")
    else:
        print_test_result("Log new meal", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 4: Get today's nutrition (should show the logged meal)
    print("4. Testing GET /api/nutrition/today (after logging meal)")
    response = make_request("GET", "/nutrition/today")
    if response and response.status_code == 200:
        data = response.json()
        if data.get("consumed", {}).get("calories") == 365:
            print_test_result("Get today's nutrition (after meal)", True, f"Consumed: {data['consumed']['calories']} calories, {len(data.get('meals', []))} meals")
        else:
            print_test_result("Get today's nutrition (after meal)", False, f"Calories not updated correctly: {data.get('consumed', {})}")
    else:
        print_test_result("Get today's nutrition (after meal)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test 5: Delete the logged meal
    if meal_id:
        print("5. Testing DELETE /api/nutrition/meals/{meal_id}")
        response = make_request("DELETE", f"/nutrition/meals/{meal_id}")
        if response and response.status_code == 200:
            data = response.json()
            if "message" in data:
                print_test_result("Delete meal", True, f"Meal deleted: {data['message']}")
            else:
                print_test_result("Delete meal", False, f"Unexpected response: {data}")
        else:
            print_test_result("Delete meal", False, f"Status: {response.status_code if response else 'No response'}")
        
        # Test 6: Verify meal is deleted
        print("6. Testing GET /api/nutrition/today (after deletion)")
        response = make_request("GET", "/nutrition/today")
        if response and response.status_code == 200:
            data = response.json()
            if data.get("consumed", {}).get("calories") == 0:
                print_test_result("Verify meal deletion", True, f"Consumed calories back to 0: {data['consumed']['calories']}")
            else:
                print_test_result("Verify meal deletion", False, f"Calories not reset: {data.get('consumed', {})}")
        else:
            print_test_result("Verify meal deletion", False, f"Status: {response.status_code if response else 'No response'}")
    else:
        print_test_result("Delete meal", False, "No meal_id available from previous test")

def main():
    """Main test execution."""
    global session_token, user_id
    
    print("🧪 GOAL CALIBRATION AND NUTRITION API TESTING")
    print("=" * 60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test started at: {datetime.now()}")
    print()
    
    # Get session token from command line or prompt
    if len(sys.argv) > 1:
        session_token = sys.argv[1]
        print(f"Using session token: {session_token[:20]}...")
    else:
        print("❌ ERROR: Session token required")
        print("Usage: python backend_test.py <session_token>")
        print("\nFirst create a test user and session using mongosh:")
        print("""
mongosh --eval "
use('test_database');
var userId = 'test-user-goals-' + Date.now();
var sessionToken = 'test_session_goals_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'goals@example.com',
  name: 'Goals Test User',
  picture: '',
  weight: 75,
  height: 175,
  age: 28,
  gender: 'male',
  activity_level: 'moderate',
  goal_type: 'maintenance',
  goal_calories: 2200,
  goal_protein: 150,
  goal_carbs: 250,
  goal_fats: 70,
  protein_percent: 30,
  carbs_percent: 40,
  fats_percent: 30,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
        """)
        return
    
    print()
    
    # Test authentication first
    print("=== TESTING AUTHENTICATION ===\n")
    response = make_request("GET", "/auth/me")
    if response and response.status_code == 200:
        user_data = response.json()
        user_id = user_data.get("user_id")
        print_test_result("Authentication", True, f"Authenticated as: {user_data.get('email')} (ID: {user_id})")
    else:
        print_test_result("Authentication", False, f"Status: {response.status_code if response else 'No response'}")
        print("❌ Cannot proceed without authentication")
        return
    
    # Run tests
    test_user_goals_endpoints()
    test_nutrition_endpoints()
    
    print("=" * 60)
    print("🏁 TESTING COMPLETED")
    print(f"Test finished at: {datetime.now()}")

if __name__ == "__main__":
    main()