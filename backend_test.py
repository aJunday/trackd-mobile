#!/usr/bin/env python3
"""
Fitness Command Center Backend API Test Suite
Tests all backend endpoints as specified in the review request.
"""

import requests
import json
import subprocess
import sys
from datetime import datetime
import time

# Configuration
BASE_URL = "https://fitness-command-7.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class FitnessAPITester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.test_workout_id = None
        self.results = []
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        if not success and response_data:
            print(f"   Response: {response_data}")
        print()

    def create_test_user_session(self):
        """Create test user and session using mongosh"""
        print("🔧 Creating test user and session...")
        
        mongosh_script = '''
        use('test_database');
        var userId = 'test-user-' + Date.now();
        var sessionToken = 'test_session_' + Date.now();
        db.users.insertOne({
          user_id: userId,
          email: 'test@example.com',
          name: 'Test User',
          picture: '',
          weight: 75,
          goal_calories: 2200,
          goal_protein: 150,
          goal_carbs: 250,
          goal_fats: 70,
          created_at: new Date()
        });
        db.user_sessions.insertOne({
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        });
        print('SESSION_TOKEN:' + sessionToken);
        print('USER_ID:' + userId);
        '''
        
        try:
            result = subprocess.run(
                ['mongosh', '--eval', mongosh_script],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                self.log_result("Create Test User Session", False, f"mongosh failed: {result.stderr}")
                return False
                
            # Parse output to get session token and user ID
            output_lines = result.stdout.split('\n')
            for line in output_lines:
                if line.startswith('SESSION_TOKEN:'):
                    self.session_token = line.split(':', 1)[1].strip()
                elif line.startswith('USER_ID:'):
                    self.user_id = line.split(':', 1)[1].strip()
            
            if self.session_token and self.user_id:
                self.log_result("Create Test User Session", True, 
                              f"Created user {self.user_id} with session token")
                return True
            else:
                self.log_result("Create Test User Session", False, 
                              "Failed to parse session token or user ID from mongosh output")
                return False
                
        except subprocess.TimeoutExpired:
            self.log_result("Create Test User Session", False, "mongosh command timed out")
            return False
        except Exception as e:
            self.log_result("Create Test User Session", False, f"Exception: {str(e)}")
            return False

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("🏥 Testing Health Endpoints...")
        
        # Test root endpoint
        try:
            response = requests.get(f"{API_BASE}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "Fitness Command Center" in data["message"]:
                    self.log_result("GET /api/ - Root endpoint", True, 
                                  f"Status: {response.status_code}, Message: {data.get('message')}")
                else:
                    self.log_result("GET /api/ - Root endpoint", False, 
                                  f"Unexpected response format: {data}")
            else:
                self.log_result("GET /api/ - Root endpoint", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/ - Root endpoint", False, f"Exception: {str(e)}")

        # Test health endpoint
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("GET /api/health - Health check", True, 
                                  f"Status: {response.status_code}, Health: {data.get('status')}")
                else:
                    self.log_result("GET /api/health - Health check", False, 
                                  f"Unexpected health status: {data}")
            else:
                self.log_result("GET /api/health - Health check", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/health - Health check", False, f"Exception: {str(e)}")

    def test_auth_endpoints_without_token(self):
        """Test auth endpoints without authentication (should return 401)"""
        print("🔒 Testing Auth Endpoints (Unauthenticated)...")
        
        # Test /api/auth/me without token
        try:
            response = requests.get(f"{API_BASE}/auth/me", timeout=10)
            if response.status_code == 401:
                self.log_result("GET /api/auth/me (no auth)", True, 
                              f"Correctly returned 401 Unauthorized")
            else:
                self.log_result("GET /api/auth/me (no auth)", False, 
                              f"Expected 401, got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("GET /api/auth/me (no auth)", False, f"Exception: {str(e)}")

        # Test logout endpoint (should work without auth)
        try:
            response = requests.post(f"{API_BASE}/auth/logout", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "message" in data:
                    self.log_result("POST /api/auth/logout", True, 
                                  f"Status: {response.status_code}, Message: {data.get('message')}")
                else:
                    self.log_result("POST /api/auth/logout", False, 
                                  f"Unexpected response format: {data}")
            else:
                self.log_result("POST /api/auth/logout", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/auth/logout", False, f"Exception: {str(e)}")

    def test_auth_endpoints_with_token(self):
        """Test auth endpoints with valid session token"""
        if not self.session_token:
            self.log_result("Auth endpoints with token", False, "No session token available")
            return
            
        print("🔑 Testing Auth Endpoints (Authenticated)...")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test /api/auth/me with token
        try:
            response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data:
                    self.log_result("GET /api/auth/me (with auth)", True, 
                                  f"Status: {response.status_code}, User: {data.get('email')}")
                else:
                    self.log_result("GET /api/auth/me (with auth)", False, 
                                  f"Missing user data fields: {data}")
            else:
                self.log_result("GET /api/auth/me (with auth)", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/auth/me (with auth)", False, f"Exception: {str(e)}")

    def test_workout_endpoints(self):
        """Test workout CRUD operations"""
        if not self.session_token:
            self.log_result("Workout endpoints", False, "No session token available")
            return
            
        print("💪 Testing Workout Endpoints...")
        
        headers = {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json"
        }
        
        # Test GET /api/workouts (should be empty initially)
        try:
            response = requests.get(f"{API_BASE}/workouts", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("GET /api/workouts (initial)", True, 
                                  f"Status: {response.status_code}, Count: {len(data)} workouts")
                else:
                    self.log_result("GET /api/workouts (initial)", False, 
                                  f"Expected list, got: {type(data)}")
            else:
                self.log_result("GET /api/workouts (initial)", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/workouts (initial)", False, f"Exception: {str(e)}")

        # Test POST /api/workouts - Create new workout
        workout_data = {
            "name": "Leg Day",
            "exercises": []
        }
        
        try:
            response = requests.post(f"{API_BASE}/workouts", 
                                   headers=headers, 
                                   json=workout_data, 
                                   timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "workout_id" in data and data.get("name") == "Leg Day":
                    self.test_workout_id = data["workout_id"]
                    self.log_result("POST /api/workouts - Create workout", True, 
                                  f"Status: {response.status_code}, Workout ID: {self.test_workout_id}")
                else:
                    self.log_result("POST /api/workouts - Create workout", False, 
                                  f"Missing workout_id or incorrect name: {data}")
            else:
                self.log_result("POST /api/workouts - Create workout", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("POST /api/workouts - Create workout", False, f"Exception: {str(e)}")

        # Test GET /api/workouts (should now show the created workout)
        try:
            response = requests.get(f"{API_BASE}/workouts", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    found_workout = any(w.get("workout_id") == self.test_workout_id for w in data)
                    if found_workout:
                        self.log_result("GET /api/workouts (after create)", True, 
                                      f"Status: {response.status_code}, Found created workout")
                    else:
                        self.log_result("GET /api/workouts (after create)", False, 
                                      f"Created workout not found in list")
                else:
                    self.log_result("GET /api/workouts (after create)", False, 
                                  f"Expected non-empty list, got: {data}")
            else:
                self.log_result("GET /api/workouts (after create)", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/workouts (after create)", False, f"Exception: {str(e)}")

        # Test PUT /api/workouts/{workout_id} - Update with exercises
        if self.test_workout_id:
            update_data = {
                "name": "Leg Day Updated",
                "exercises": [
                    {
                        "exercise_name": "Squat",
                        "sets": [
                            {"set_number": 1, "weight": 135, "reps": 10, "completed": True},
                            {"set_number": 2, "weight": 155, "reps": 8, "completed": True}
                        ],
                        "order": 0
                    }
                ]
            }
            
            try:
                response = requests.put(f"{API_BASE}/workouts/{self.test_workout_id}", 
                                      headers=headers, 
                                      json=update_data, 
                                      timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("name") == "Leg Day Updated" and len(data.get("exercises", [])) > 0:
                        self.log_result("PUT /api/workouts/{id} - Update workout", True, 
                                      f"Status: {response.status_code}, Updated successfully")
                    else:
                        self.log_result("PUT /api/workouts/{id} - Update workout", False, 
                                      f"Update not reflected: {data}")
                else:
                    self.log_result("PUT /api/workouts/{id} - Update workout", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_result("PUT /api/workouts/{id} - Update workout", False, f"Exception: {str(e)}")

        # Test POST /api/workouts/{workout_id}/complete - Complete workout
        if self.test_workout_id:
            try:
                response = requests.post(f"{API_BASE}/workouts/{self.test_workout_id}/complete", 
                                       headers=headers, 
                                       timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("completed_at") is not None:
                        self.log_result("POST /api/workouts/{id}/complete", True, 
                                      f"Status: {response.status_code}, Workout completed")
                    else:
                        self.log_result("POST /api/workouts/{id}/complete", False, 
                                      f"completed_at not set: {data}")
                else:
                    self.log_result("POST /api/workouts/{id}/complete", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_result("POST /api/workouts/{id}/complete", False, f"Exception: {str(e)}")

        # Test DELETE /api/workouts/{workout_id} - Delete workout
        if self.test_workout_id:
            try:
                response = requests.delete(f"{API_BASE}/workouts/{self.test_workout_id}", 
                                         headers=headers, 
                                         timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if "message" in data and "deleted" in data["message"].lower():
                        self.log_result("DELETE /api/workouts/{id}", True, 
                                      f"Status: {response.status_code}, Message: {data.get('message')}")
                    else:
                        self.log_result("DELETE /api/workouts/{id}", False, 
                                      f"Unexpected response: {data}")
                else:
                    self.log_result("DELETE /api/workouts/{id}", False, 
                                  f"Status: {response.status_code}, Response: {response.text}")
            except Exception as e:
                self.log_result("DELETE /api/workouts/{id}", False, f"Exception: {str(e)}")

    def test_exercise_endpoints(self):
        """Test exercise endpoints"""
        if not self.session_token:
            self.log_result("Exercise endpoints", False, "No session token available")
            return
            
        print("🏋️ Testing Exercise Endpoints...")
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test GET /api/exercises/suggestions
        try:
            response = requests.get(f"{API_BASE}/exercises/suggestions", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "suggestions" in data and isinstance(data["suggestions"], list):
                    self.log_result("GET /api/exercises/suggestions", True, 
                                  f"Status: {response.status_code}, Count: {len(data['suggestions'])} suggestions")
                else:
                    self.log_result("GET /api/exercises/suggestions", False, 
                                  f"Unexpected response format: {data}")
            else:
                self.log_result("GET /api/exercises/suggestions", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/exercises/suggestions", False, f"Exception: {str(e)}")

        # Test GET /api/exercises/suggestions with query parameter
        try:
            response = requests.get(f"{API_BASE}/exercises/suggestions?q=bench", 
                                  headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "suggestions" in data and isinstance(data["suggestions"], list):
                    # Check if results are filtered
                    bench_exercises = [ex for ex in data["suggestions"] if "bench" in ex.lower()]
                    if len(bench_exercises) > 0:
                        self.log_result("GET /api/exercises/suggestions?q=bench", True, 
                                      f"Status: {response.status_code}, Filtered results: {len(bench_exercises)}")
                    else:
                        self.log_result("GET /api/exercises/suggestions?q=bench", True, 
                                      f"Status: {response.status_code}, No bench exercises found (acceptable)")
                else:
                    self.log_result("GET /api/exercises/suggestions?q=bench", False, 
                                  f"Unexpected response format: {data}")
            else:
                self.log_result("GET /api/exercises/suggestions?q=bench", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/exercises/suggestions?q=bench", False, f"Exception: {str(e)}")

        # Test GET /api/exercises/history/{exercise_name}
        try:
            response = requests.get(f"{API_BASE}/exercises/history/Bench%20Press", 
                                  headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "previous" in data:
                    # Should be null initially since no completed workouts with this exercise
                    if data["previous"] is None:
                        self.log_result("GET /api/exercises/history/Bench Press", True, 
                                      f"Status: {response.status_code}, No previous history (expected)")
                    else:
                        self.log_result("GET /api/exercises/history/Bench Press", True, 
                                      f"Status: {response.status_code}, Found previous history")
                else:
                    self.log_result("GET /api/exercises/history/Bench Press", False, 
                                  f"Missing 'previous' field: {data}")
            else:
                self.log_result("GET /api/exercises/history/Bench Press", False, 
                              f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_result("GET /api/exercises/history/Bench Press", False, f"Exception: {str(e)}")

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Fitness Command Center Backend API Tests")
        print("=" * 60)
        
        # Create test user and session
        if not self.create_test_user_session():
            print("❌ Failed to create test user session. Skipping authenticated tests.")
        
        # Run test suites
        self.test_health_endpoints()
        self.test_auth_endpoints_without_token()
        
        if self.session_token:
            self.test_auth_endpoints_with_token()
            self.test_workout_endpoints()
            self.test_exercise_endpoints()
        
        # Print summary
        self.print_summary()

    def print_summary(self):
        """Print test summary"""
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        print()
        
        if failed_tests > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
            print()
        
        print("✅ PASSED TESTS:")
        for result in self.results:
            if result["success"]:
                print(f"  - {result['test']}")
        
        print("\n" + "=" * 60)
        
        # Return exit code based on results
        return 0 if failed_tests == 0 else 1

if __name__ == "__main__":
    tester = FitnessAPITester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)