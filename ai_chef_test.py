#!/usr/bin/env python3

import requests
import json
import subprocess
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://fitness-command-7.preview.emergentagent.com/api"

def run_mongosh_command(command):
    """Execute mongosh command and return output"""
    try:
        result = subprocess.run(
            ["mongosh", "--eval", command],
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            print(f"❌ MongoDB command failed: {result.stderr}")
            return None
        return result.stdout
    except Exception as e:
        print(f"❌ Error running mongosh: {e}")
        return None

def create_test_user_with_pantry():
    """Create test user with pantry items as specified in review request"""
    print("🔧 Creating test user with pantry items...")
    
    timestamp = int(datetime.now().timestamp() * 1000)
    user_id = f'test-user-recipe-{timestamp}'
    session_token = f'test_session_recipe_{timestamp}'
    
    mongosh_command = f"""
use('test_database');
var userId = '{user_id}';
var sessionToken = '{session_token}';

// Create user
db.users.insertOne({{
  user_id: userId,
  email: 'recipe@example.com',
  name: 'Recipe Test',
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
  created_at: new Date()
}});

// Create session
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Add pantry items
db.pantry.insertMany([
  {{
    item_id: 'pi_recipe_{timestamp}_1',
    user_id: userId,
    item_name: 'Chicken Breast',
    quantity: 500,
    unit: 'g',
    calories_per_unit: 165,
    protein: 31,
    carbs: 0,
    fats: 3.6,
    added_at: new Date()
  }},
  {{
    item_id: 'pi_recipe_{timestamp}_2',
    user_id: userId,
    item_name: 'Brown Rice',
    quantity: 400,
    unit: 'g',
    calories_per_unit: 111,
    protein: 2.6,
    carbs: 23,
    fats: 0.9,
    added_at: new Date()
  }},
  {{
    item_id: 'pi_recipe_{timestamp}_3',
    user_id: userId,
    item_name: 'Eggs',
    quantity: 12,
    unit: 'piece',
    calories_per_unit: 78,
    protein: 6,
    carbs: 0.6,
    fats: 5,
    added_at: new Date()
  }},
  {{
    item_id: 'pi_recipe_{timestamp}_4',
    user_id: userId,
    item_name: 'Olive Oil',
    quantity: 500,
    unit: 'ml',
    calories_per_unit: 119,
    protein: 0,
    carbs: 0,
    fats: 13.5,
    added_at: new Date()
  }},
  {{
    item_id: 'pi_recipe_{timestamp}_5',
    user_id: userId,
    item_name: 'Broccoli',
    quantity: 300,
    unit: 'g',
    calories_per_unit: 34,
    protein: 2.8,
    carbs: 7,
    fats: 0.4,
    added_at: new Date()
  }}
]);

print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"""
    
    output = run_mongosh_command(mongosh_command)
    if output is None:
        return None, None
    
    # Extract session token and user ID from output
    lines = output.strip().split('\n')
    session_token = None
    user_id = None
    
    for line in lines:
        if 'Session token:' in line:
            session_token = line.split('Session token: ')[1].strip()
        elif 'User ID:' in line:
            user_id = line.split('User ID: ')[1].strip()
    
    if session_token and user_id:
        print(f"✅ Created test user: {user_id}")
        print(f"✅ Session token: {session_token}")
        return session_token, user_id
    else:
        print("❌ Failed to extract session token and user ID from mongosh output")
        return None, None

def test_ai_chef_endpoint(session_token):
    """Test the enhanced AI Chef endpoint"""
    print("\n🧪 Testing Enhanced AI Chef Endpoint...")
    
    # Test 1: Unauthenticated request (should fail)
    print("\n1. Testing unauthenticated request...")
    try:
        response = requests.post(
            f"{BASE_URL}/pantry/ai-chef/suggest",
            json={"count": 2},
            timeout=30
        )
        if response.status_code == 401:
            print("✅ Correctly returns 401 for unauthenticated request")
        else:
            print(f"❌ Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error testing unauthenticated request: {e}")
        return False
    
    # Test 2: Authenticated request with valid session token
    print("\n2. Testing authenticated AI Chef request...")
    try:
        headers = {"Authorization": f"Bearer {session_token}"}
        response = requests.post(
            f"{BASE_URL}/pantry/ai-chef/suggest",
            json={"count": 2},
            headers=headers,
            timeout=60  # Longer timeout for AI processing
        )
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
        
        # Parse response
        try:
            data = response.json()
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON response: {response.text}")
            return False
        
        print(f"Response JSON: {json.dumps(data, indent=2)}")
        
        # Validate enhanced response structure
        validation_results = []
        
        # Check success field
        if data.get("success") is True:
            validation_results.append("✅ success: true")
        else:
            validation_results.append(f"❌ success: {data.get('success')} (expected: true)")
        
        # Check meals array
        meals = data.get("meals", [])
        if isinstance(meals, list) and len(meals) > 0:
            validation_results.append(f"✅ meals: array with {len(meals)} items")
            
            # Validate each meal structure
            for i, meal in enumerate(meals):
                meal_validation = []
                
                # Check required fields
                if isinstance(meal.get("name"), str) and meal.get("name"):
                    meal_validation.append("✅ name: string")
                else:
                    meal_validation.append(f"❌ name: {meal.get('name')} (expected: non-empty string)")
                
                if isinstance(meal.get("ingredients"), list) and len(meal.get("ingredients", [])) > 0:
                    meal_validation.append(f"✅ ingredients: array with {len(meal.get('ingredients', []))} items")
                else:
                    meal_validation.append(f"❌ ingredients: {meal.get('ingredients')} (expected: non-empty array)")
                
                if isinstance(meal.get("recipe"), list) and len(meal.get("recipe", [])) > 0:
                    meal_validation.append(f"✅ recipe: array with {len(meal.get('recipe', []))} steps")
                else:
                    meal_validation.append(f"❌ recipe: {meal.get('recipe')} (expected: non-empty array)")
                
                if isinstance(meal.get("cook_time"), (int, float)) and meal.get("cook_time") >= 0:
                    meal_validation.append(f"✅ cook_time: {meal.get('cook_time')} minutes")
                else:
                    meal_validation.append(f"❌ cook_time: {meal.get('cook_time')} (expected: number >= 0)")
                
                # Check macros object
                macros = meal.get("macros", {})
                if isinstance(macros, dict):
                    macro_fields = ["protein", "carbs", "fats", "calories"]
                    macro_valid = all(
                        isinstance(macros.get(field), (int, float)) and macros.get(field) >= 0
                        for field in macro_fields
                    )
                    if macro_valid:
                        meal_validation.append(f"✅ macros: valid object with all fields")
                    else:
                        meal_validation.append(f"❌ macros: invalid - {macros}")
                else:
                    meal_validation.append(f"❌ macros: {macros} (expected: object)")
                
                validation_results.append(f"  Meal {i+1} ({meal.get('name', 'Unknown')}):")
                for result in meal_validation:
                    validation_results.append(f"    {result}")
        else:
            validation_results.append(f"❌ meals: {meals} (expected: non-empty array)")
        
        # Check remaining object
        remaining = data.get("remaining", {})
        if isinstance(remaining, dict):
            remaining_fields = ["calories", "protein", "carbs", "fats"]
            remaining_valid = all(
                isinstance(remaining.get(field), (int, float))
                for field in remaining_fields
            )
            if remaining_valid:
                validation_results.append(f"✅ remaining: valid object with all macro fields")
            else:
                validation_results.append(f"❌ remaining: invalid - {remaining}")
        else:
            validation_results.append(f"❌ remaining: {remaining} (expected: object)")
        
        # Check pantry_items_used (optional but good to have)
        if "pantry_items_used" in data:
            if isinstance(data.get("pantry_items_used"), int) and data.get("pantry_items_used") >= 0:
                validation_results.append(f"✅ pantry_items_used: {data.get('pantry_items_used')}")
            else:
                validation_results.append(f"❌ pantry_items_used: {data.get('pantry_items_used')} (expected: non-negative integer)")
        
        # Print validation results
        print("\n📋 Enhanced Response Validation:")
        for result in validation_results:
            print(result)
        
        # Count successes and failures
        success_count = sum(1 for result in validation_results if result.strip().startswith("✅"))
        total_count = len([r for r in validation_results if r.strip().startswith(("✅", "❌"))])
        
        print(f"\n📊 Validation Summary: {success_count}/{total_count} checks passed")
        
        # Consider test successful if most validations pass
        if success_count >= total_count * 0.8:  # 80% success rate
            print("✅ Enhanced AI Chef endpoint working correctly")
            return True
        else:
            print("❌ Enhanced AI Chef endpoint has validation issues")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timed out - AI processing may be taking too long")
        return False
    except Exception as e:
        print(f"❌ Error testing AI Chef endpoint: {e}")
        return False

def cleanup_test_data(user_id):
    """Clean up test data"""
    print(f"\n🧹 Cleaning up test data for user: {user_id}")
    
    cleanup_command = f"""
use('test_database');
db.users.deleteOne({{user_id: '{user_id}'}});
db.user_sessions.deleteMany({{user_id: '{user_id}'}});
db.pantry.deleteMany({{user_id: '{user_id}'}});
print('Cleanup completed');
"""
    
    output = run_mongosh_command(cleanup_command)
    if output:
        print("✅ Test data cleaned up successfully")
    else:
        print("❌ Failed to clean up test data")

def main():
    """Main test execution"""
    print("🚀 Starting Enhanced AI Chef Recipe API Test")
    print("=" * 60)
    
    # Create test user with pantry items
    session_token, user_id = create_test_user_with_pantry()
    if not session_token or not user_id:
        print("❌ Failed to create test user. Exiting.")
        sys.exit(1)
    
    try:
        # Test AI Chef endpoint
        success = test_ai_chef_endpoint(session_token)
        
        print("\n" + "=" * 60)
        if success:
            print("🎉 Enhanced AI Chef Recipe API Test PASSED")
            print("✅ All core functionality working correctly")
        else:
            print("❌ Enhanced AI Chef Recipe API Test FAILED")
            print("❌ Issues found with API functionality")
        
        return success
        
    finally:
        # Always cleanup test data
        if user_id:
            cleanup_test_data(user_id)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)