from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="TRACKD API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["auth"])
workout_router = APIRouter(prefix="/workouts", tags=["workouts"])
exercise_router = APIRouter(prefix="/exercises", tags=["exercises"])
nutrition_router = APIRouter(prefix="/nutrition", tags=["nutrition"])
user_router = APIRouter(prefix="/users", tags=["users"])
pantry_router = APIRouter(prefix="/pantry", tags=["pantry"])
onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])
measurements_router = APIRouter(prefix="/measurements", tags=["measurements"])
templates_router = APIRouter(prefix="/templates", tags=["templates"])
scanner_router = APIRouter(prefix="/scanner", tags=["scanner"])
programs_router = APIRouter(prefix="/programs", tags=["programs"])
coach_router = APIRouter(prefix="/coach", tags=["coach"])
shopping_router = APIRouter(prefix="/shopping-list", tags=["shopping-list"])

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    # Onboarding data
    onboarding_complete: bool = False
    age: Optional[int] = None
    biological_sex: Optional[str] = None  # 'male', 'female'
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity_level: Optional[str] = None  # sedentary, lightly_active, moderately_active, very_active, extra_active
    goal_type: Optional[str] = None  # lose_fat, maintain, build_muscle
    sport: Optional[str] = None
    training_days_per_week: Optional[int] = None  # 2-6
    split_id: Optional[str] = None  # e.g. 'upper_lower_4', 'ppl_3'
    bmr: Optional[float] = None
    tdee: Optional[float] = None
    goal_calories: int = 2200
    goal_protein: int = 150  # grams
    goal_carbs: int = 250  # grams
    goal_fats: int = 70  # grams
    # Unit preferences
    use_metric_weight: bool = True
    use_metric_height: bool = True
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OnboardingData(BaseModel):
    name: str
    age: int
    biological_sex: str  # 'male', 'female'
    height_cm: float
    weight_kg: float
    activity_level: str
    goal_type: str
    sport: Optional[str] = None
    training_days_per_week: Optional[int] = None  # 2-6
    split_id: Optional[str] = None  # e.g. 'upper_lower_4', 'ppl_3'

class BodyMeasurement(BaseModel):
    measurement_id: str = Field(default_factory=lambda: f"bm_{uuid.uuid4().hex[:12]}")
    user_id: str
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    weight_kg: Optional[float] = None
    neck_cm: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    left_arm_cm: Optional[float] = None
    right_arm_cm: Optional[float] = None
    left_thigh_cm: Optional[float] = None
    right_thigh_cm: Optional[float] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PersonalRecord(BaseModel):
    pr_id: str = Field(default_factory=lambda: f"pr_{uuid.uuid4().hex[:12]}")
    user_id: str
    exercise_name: str
    weight: float
    reps: int
    one_rm: float  # Calculated 1RM
    achieved_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    workout_id: Optional[str] = None

class WorkoutTemplate(BaseModel):
    template_id: str = Field(default_factory=lambda: f"tmpl_{uuid.uuid4().hex[:12]}")
    user_id: Optional[str] = None  # None for pre-built templates
    name: str
    exercises: List[dict] = []
    is_preset: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SetData(BaseModel):
    set_number: int
    weight: float = 0
    reps: int = 0
    rpe: Optional[float] = None
    completed: bool = False
    completed_at: Optional[datetime] = None

class ExerciseInWorkout(BaseModel):
    exercise_id: str = Field(default_factory=lambda: f"ex_{uuid.uuid4().hex[:12]}")
    exercise_name: str
    sets: List[SetData] = []
    notes: Optional[str] = None
    order: int = 0

class Workout(BaseModel):
    workout_id: str = Field(default_factory=lambda: f"wo_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str = "Workout"
    exercises: List[ExerciseInWorkout] = []
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None
    is_template: bool = False

class WorkoutCreate(BaseModel):
    name: str = "Workout"
    exercises: List[ExerciseInWorkout] = []

class WorkoutUpdate(BaseModel):
    name: Optional[str] = None
    exercises: Optional[List[ExerciseInWorkout]] = None
    completed_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    notes: Optional[str] = None

class ExerciseHistory(BaseModel):
    exercise_name: str
    last_sets: List[SetData]
    last_workout_date: datetime

# ==================== NUTRITION MODELS ====================

class MealItem(BaseModel):
    item_id: str = Field(default_factory=lambda: f"mi_{uuid.uuid4().hex[:12]}")
    name: str
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fats: float = 0
    quantity: float = 1
    unit: str = "serving"

class Meal(BaseModel):
    meal_id: str = Field(default_factory=lambda: f"meal_{uuid.uuid4().hex[:12]}")
    user_id: str
    meal_type: str = "snack"  # breakfast, lunch, dinner, snack
    items: List[MealItem] = []
    total_calories: float = 0
    total_protein: float = 0
    total_carbs: float = 0
    total_fats: float = 0
    logged_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))

class MealCreate(BaseModel):
    meal_type: str = "snack"
    items: List[MealItem] = []

class UserGoalsUpdate(BaseModel):
    weight: Optional[float] = None
    height: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: Optional[str] = None
    goal_type: Optional[str] = None
    goal_calories: Optional[int] = None
    goal_protein: Optional[int] = None
    goal_carbs: Optional[int] = None
    goal_fats: Optional[int] = None
    protein_percent: Optional[int] = None
    carbs_percent: Optional[int] = None
    fats_percent: Optional[int] = None

class TDEECalculation(BaseModel):
    weight: float  # kg
    height: float  # cm
    age: int
    gender: str
    activity_level: str

# ==================== PANTRY MODELS ====================

class PantryItem(BaseModel):
    item_id: str = Field(default_factory=lambda: f"pi_{uuid.uuid4().hex[:12]}")
    user_id: str
    item_name: str
    quantity: float = 1
    unit: str = "serving"
    calories_per_unit: float = 0
    protein: float = 0
    carbs: float = 0
    fats: float = 0
    barcode_id: Optional[str] = None
    serving_size: Optional[str] = None
    brand: Optional[str] = None
    image_base64: Optional[str] = None
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used: Optional[datetime] = None

class PantryItemCreate(BaseModel):
    item_name: str
    quantity: float = 1
    unit: str = "serving"
    calories_per_unit: float = 0
    protein: float = 0
    carbs: float = 0
    fats: float = 0
    barcode_id: Optional[str] = None
    serving_size: Optional[str] = None
    brand: Optional[str] = None

class PantryItemUpdate(BaseModel):
    item_name: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    calories_per_unit: Optional[float] = None
    protein: Optional[float] = None
    carbs: Optional[float] = None
    fats: Optional[float] = None

class BarcodeScanRequest(BaseModel):
    barcode: str

class LabelScanRequest(BaseModel):
    image_base64: str

class UseItemRequest(BaseModel):
    quantity: float

# ==================== AUTH HELPERS ====================

async def get_current_user(request: Request) -> User:
    """Get current authenticated user from session token."""
    # Check cookie first, then Authorization header
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ==================== AUTH ROUTES ====================

class SessionRequest(BaseModel):
    session_id: str

@auth_router.post("/session")
async def create_session(request: SessionRequest, response: Response):
    """Exchange session_id from Emergent Auth for session token."""
    try:
        # Call Emergent Auth API
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            auth_data = auth_response.json()
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        email = auth_data.get("email")
        name = auth_data.get("name", "")
        picture = auth_data.get("picture", "")
        session_token = auth_data.get("session_token")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            # Update user info
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            # Create new user
            new_user = User(
                user_id=user_id,
                email=email,
                name=name,
                picture=picture
            )
            await db.users.insert_one(new_user.dict())
        
        # Store session
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        }
        
        # Remove old sessions for this user
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_sessions.insert_one(session_doc)
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60  # 7 days
        )
        
        # Get full user data
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {"user": user_doc, "session_token": session_token}
        
    except httpx.HTTPError as e:
        logger.error(f"Auth API error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service error")

@auth_router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user."""
    return user.dict()

@auth_router.post("/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session."""
    session_token = request.cookies.get("session_token")
    
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out successfully"}

# ==================== WORKOUT ROUTES ====================

@workout_router.get("", response_model=List[Dict[str, Any]])
async def get_workouts(user: User = Depends(get_current_user)):
    """Get all workouts for current user."""
    workouts = await db.workouts.find(
        {"user_id": user.user_id, "is_template": False},
        {"_id": 0}
    ).sort("started_at", -1).to_list(100)
    return workouts

@workout_router.post("", response_model=Dict[str, Any])
async def create_workout(
    workout_data: WorkoutCreate,
    user: User = Depends(get_current_user)
):
    """Start a new workout."""
    workout = Workout(
        user_id=user.user_id,
        name=workout_data.name,
        exercises=workout_data.exercises
    )
    
    await db.workouts.insert_one(workout.dict())
    
    # Return without _id
    return workout.dict()

@workout_router.get("/{workout_id}", response_model=Dict[str, Any])
async def get_workout(
    workout_id: str,
    user: User = Depends(get_current_user)
):
    """Get a specific workout."""
    workout = await db.workouts.find_one(
        {"workout_id": workout_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return workout

@workout_router.put("/{workout_id}", response_model=Dict[str, Any])
async def update_workout(
    workout_id: str,
    workout_update: WorkoutUpdate,
    user: User = Depends(get_current_user)
):
    """Update a workout."""
    # Get existing workout
    existing = await db.workouts.find_one(
        {"workout_id": workout_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    # Build update dict
    update_data = {k: v for k, v in workout_update.dict().items() if v is not None}
    
    if update_data:
        # Convert exercises to dict format
        if "exercises" in update_data:
            update_data["exercises"] = [
                ex.dict() if hasattr(ex, 'dict') else ex 
                for ex in update_data["exercises"]
            ]
        
        await db.workouts.update_one(
            {"workout_id": workout_id},
            {"$set": update_data}
        )
    
    # Return updated workout
    updated = await db.workouts.find_one(
        {"workout_id": workout_id},
        {"_id": 0}
    )
    
    return updated

@workout_router.delete("/{workout_id}")
async def delete_workout(
    workout_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a workout."""
    result = await db.workouts.delete_one(
        {"workout_id": workout_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return {"message": "Workout deleted successfully"}

@workout_router.post("/{workout_id}/complete", response_model=Dict[str, Any])
async def complete_workout(
    workout_id: str,
    user: User = Depends(get_current_user)
):
    """Mark workout as complete."""
    workout = await db.workouts.find_one(
        {"workout_id": workout_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not workout:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    completed_at = datetime.now(timezone.utc)
    started_at = workout["started_at"]
    
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at)
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    
    duration_minutes = int((completed_at - started_at).total_seconds() / 60)
    
    await db.workouts.update_one(
        {"workout_id": workout_id},
        {"$set": {
            "completed_at": completed_at,
            "duration_minutes": duration_minutes
        }}
    )
    
    updated = await db.workouts.find_one(
        {"workout_id": workout_id},
        {"_id": 0}
    )
    
    return updated

# ==================== EXERCISE ROUTES ====================

@exercise_router.get("/history/{exercise_name}")
async def get_exercise_history(
    exercise_name: str,
    user: User = Depends(get_current_user)
):
    """Get previous workout data for an exercise (Copy Previous feature)."""
    # Find the most recent completed workout with this exercise
    workouts = await db.workouts.find(
        {
            "user_id": user.user_id,
            "completed_at": {"$ne": None},
            "exercises.exercise_name": {"$regex": f"^{exercise_name}$", "$options": "i"}
        },
        {"_id": 0}
    ).sort("completed_at", -1).to_list(1)
    
    if not workouts:
        return {"previous": None}
    
    workout = workouts[0]
    
    # Find the exercise in the workout
    for exercise in workout.get("exercises", []):
        if exercise["exercise_name"].lower() == exercise_name.lower():
            return {
                "previous": {
                    "exercise_name": exercise["exercise_name"],
                    "sets": exercise["sets"],
                    "workout_date": workout["completed_at"],
                    "workout_name": workout["name"]
                }
            }
    
    return {"previous": None}

@exercise_router.get("/suggestions")
async def get_exercise_suggestions(
    q: str = "",
    user: User = Depends(get_current_user)
):
    """Get exercise name suggestions based on user's history."""
    # Get unique exercise names from user's workouts
    pipeline = [
        {"$match": {"user_id": user.user_id}},
        {"$unwind": "$exercises"},
        {"$group": {"_id": "$exercises.exercise_name"}},
        {"$sort": {"_id": 1}}
    ]
    
    if q:
        pipeline.insert(2, {
            "$match": {"exercises.exercise_name": {"$regex": q, "$options": "i"}}
        })
    
    results = await db.workouts.aggregate(pipeline).to_list(50)
    
    # Default exercise suggestions
    default_exercises = [
        "Bench Press", "Squat", "Deadlift", "Overhead Press",
        "Barbell Row", "Pull Up", "Dumbbell Curl", "Tricep Pushdown",
        "Leg Press", "Lat Pulldown", "Cable Fly", "Lateral Raise",
        "Face Pull", "Romanian Deadlift", "Leg Curl", "Leg Extension"
    ]
    
    user_exercises = [r["_id"] for r in results]
    
    # Combine and filter
    all_exercises = list(set(user_exercises + default_exercises))
    
    if q:
        all_exercises = [e for e in all_exercises if q.lower() in e.lower()]
    
    return {"suggestions": sorted(all_exercises)[:20]}

# ==================== USER GOALS ROUTES ====================

def calculate_tdee(weight: float, height: float, age: int, gender: str, activity_level: str) -> int:
    """Calculate TDEE using Mifflin-St Jeor equation."""
    # BMR calculation
    if gender.lower() == 'male':
        bmr = 10 * weight + 6.25 * height - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    
    # Activity multiplier
    multipliers = {
        'sedentary': 1.2,
        'light': 1.375,
        'moderate': 1.55,
        'active': 1.725,
        'very_active': 1.9
    }
    
    multiplier = multipliers.get(activity_level.lower(), 1.55)
    return int(bmr * multiplier)

@user_router.put("/goals")
async def update_user_goals(
    goals: UserGoalsUpdate,
    user: User = Depends(get_current_user)
):
    """Update user's fitness goals."""
    update_data = {k: v for k, v in goals.dict().items() if v is not None}
    
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    return updated_user

class SplitUpdateRequest(BaseModel):
    training_days_per_week: Optional[int] = None
    split_id: Optional[str] = None

@user_router.put("/split")
async def update_user_split(
    req: SplitUpdateRequest,
    user: User = Depends(get_current_user)
):
    """Update user's training schedule (days/week + chosen split)."""
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    return {"success": True, **update_data}

@user_router.post("/calculate-tdee")
async def calculate_user_tdee(
    data: TDEECalculation,
    user: User = Depends(get_current_user)
):
    """Calculate TDEE and suggested macros."""
    tdee = calculate_tdee(
        data.weight, data.height, data.age, data.gender, data.activity_level
    )
    
    # Calculate presets
    cutting = tdee - 500
    maintenance = tdee
    bulking = tdee + 500
    
    return {
        "tdee": maintenance,
        "presets": {
            "cutting": {
                "calories": cutting,
                "protein": int(data.weight * 2.2),  # 2.2g per kg for cutting
                "description": "TDEE - 500 for weight loss"
            },
            "maintenance": {
                "calories": maintenance,
                "protein": int(data.weight * 1.8),
                "description": "Maintain current weight"
            },
            "bulking": {
                "calories": bulking,
                "protein": int(data.weight * 2.0),
                "description": "TDEE + 500 for muscle gain"
            }
        }
    }

@user_router.post("/apply-preset/{preset_type}")
async def apply_goal_preset(
    preset_type: str,
    user: User = Depends(get_current_user)
):
    """Apply a goal preset (cutting, maintenance, bulking)."""
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not all([user_doc.get("weight"), user_doc.get("height"), 
                user_doc.get("age"), user_doc.get("gender")]):
        raise HTTPException(
            status_code=400, 
            detail="Please set your weight, height, age, and gender first"
        )
    
    tdee = calculate_tdee(
        user_doc["weight"],
        user_doc["height"],
        user_doc["age"],
        user_doc["gender"],
        user_doc.get("activity_level", "moderate")
    )
    
    presets = {
        "cutting": {"calories": tdee - 500, "protein_mult": 2.2},
        "maintenance": {"calories": tdee, "protein_mult": 1.8},
        "bulking": {"calories": tdee + 500, "protein_mult": 2.0}
    }
    
    if preset_type not in presets:
        raise HTTPException(status_code=400, detail="Invalid preset type")
    
    preset = presets[preset_type]
    calories = preset["calories"]
    protein = int(user_doc["weight"] * preset["protein_mult"])
    
    # Calculate macros based on percentages (default: 30/40/30)
    protein_cals = protein * 4
    remaining_cals = calories - protein_cals
    carbs = int(remaining_cals * 0.57 / 4)  # 57% of remaining to carbs
    fats = int(remaining_cals * 0.43 / 9)   # 43% of remaining to fats
    
    update_data = {
        "goal_type": preset_type,
        "goal_calories": calories,
        "goal_protein": protein,
        "goal_carbs": carbs,
        "goal_fats": fats
    }
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_data}
    )
    
    return {
        "message": f"Applied {preset_type} preset",
        "goals": update_data
    }

# ==================== NUTRITION/MEAL ROUTES ====================

@nutrition_router.get("/today")
async def get_today_nutrition(user: User = Depends(get_current_user)):
    """Get today's nutrition summary and remaining calories."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get all meals for today
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0}
    ).to_list(100)
    
    # Calculate totals
    total_calories = sum(m.get("total_calories", 0) for m in meals)
    total_protein = sum(m.get("total_protein", 0) for m in meals)
    total_carbs = sum(m.get("total_carbs", 0) for m in meals)
    total_fats = sum(m.get("total_fats", 0) for m in meals)
    
    # Get user goals
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    goal_calories = user_doc.get("goal_calories", 2200)
    goal_protein = user_doc.get("goal_protein", 150)
    goal_carbs = user_doc.get("goal_carbs", 250)
    goal_fats = user_doc.get("goal_fats", 70)
    
    # Calculate remaining
    remaining_calories = goal_calories - total_calories
    remaining_protein = goal_protein - total_protein
    remaining_carbs = goal_carbs - total_carbs
    remaining_fats = goal_fats - total_fats
    
    # Calculate progress percentage
    calorie_progress = min(100, (total_calories / goal_calories * 100)) if goal_calories > 0 else 0
    exceeded = total_calories > goal_calories * 1.1  # More than 10% over
    
    return {
        "date": today,
        "consumed": {
            "calories": round(total_calories, 1),
            "protein": round(total_protein, 1),
            "carbs": round(total_carbs, 1),
            "fats": round(total_fats, 1)
        },
        "goals": {
            "calories": goal_calories,
            "protein": goal_protein,
            "carbs": goal_carbs,
            "fats": goal_fats
        },
        "remaining": {
            "calories": round(remaining_calories, 1),
            "protein": round(remaining_protein, 1),
            "carbs": round(remaining_carbs, 1),
            "fats": round(remaining_fats, 1)
        },
        "progress": {
            "calories_percent": round(calorie_progress, 1),
            "exceeded": exceeded
        },
        "meals": meals
    }

@nutrition_router.get("/meals")
async def get_meals(
    date: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get meals for a specific date or today."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": target_date},
        {"_id": 0}
    ).sort("logged_at", 1).to_list(100)
    
    return {"meals": meals, "date": target_date}

@nutrition_router.post("/meals")
async def log_meal(
    meal_data: MealCreate,
    user: User = Depends(get_current_user)
):
    """Log a new meal."""
    # Calculate totals from items
    total_calories = sum(item.calories * item.quantity for item in meal_data.items)
    total_protein = sum(item.protein * item.quantity for item in meal_data.items)
    total_carbs = sum(item.carbs * item.quantity for item in meal_data.items)
    total_fats = sum(item.fats * item.quantity for item in meal_data.items)
    
    meal = Meal(
        user_id=user.user_id,
        meal_type=meal_data.meal_type,
        items=meal_data.items,
        total_calories=total_calories,
        total_protein=total_protein,
        total_carbs=total_carbs,
        total_fats=total_fats
    )
    
    await db.meals.insert_one(meal.dict())
    
    return meal.dict()

@nutrition_router.delete("/meals/{meal_id}")
async def delete_meal(
    meal_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a logged meal."""
    result = await db.meals.delete_one(
        {"meal_id": meal_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal deleted successfully"}

# ==================== PANTRY ROUTES ====================

# Initialize LLM for OCR (lazy loading)
_llm_chat = None

async def get_llm_chat():
    global _llm_chat
    if _llm_chat is None:
        from emergentintegrations.llm.chat import LlmChat
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        _llm_chat = LlmChat(
            api_key=api_key,
            session_id=f"pantry_ocr_{uuid.uuid4().hex[:8]}",
            system_message="""You are a nutrition label analyzer. When given an image of a nutrition facts label, 
            extract the following information and return it as JSON:
            {
                "item_name": "product name if visible, otherwise 'Unknown Product'",
                "serving_size": "the serving size text",
                "calories_per_unit": numeric value of calories per serving,
                "protein": numeric value of protein in grams,
                "carbs": numeric value of carbohydrates in grams,
                "fats": numeric value of total fat in grams,
                "brand": "brand name if visible"
            }
            Only return the JSON object, no other text."""
        ).with_model("openai", "gpt-4o")
    return _llm_chat

@pantry_router.get("")
async def get_pantry_items(
    search: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Get all pantry items for current user."""
    query = {"user_id": user.user_id}
    
    if search:
        query["item_name"] = {"$regex": search, "$options": "i"}
    
    items = await db.pantry.find(
        query,
        {"_id": 0}
    ).sort("added_at", -1).to_list(100)
    
    return {"items": items}

@pantry_router.post("")
async def add_pantry_item(
    item_data: PantryItemCreate,
    user: User = Depends(get_current_user)
):
    """Add a new item to pantry."""
    item = PantryItem(
        user_id=user.user_id,
        **item_data.dict()
    )
    
    await db.pantry.insert_one(item.dict())
    
    return item.dict()

@pantry_router.get("/{item_id}")
async def get_pantry_item(
    item_id: str,
    user: User = Depends(get_current_user)
):
    """Get a specific pantry item."""
    item = await db.pantry.find_one(
        {"item_id": item_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return item

@pantry_router.put("/{item_id}")
async def update_pantry_item(
    item_id: str,
    item_update: PantryItemUpdate,
    user: User = Depends(get_current_user)
):
    """Update a pantry item."""
    existing = await db.pantry.find_one(
        {"item_id": item_id, "user_id": user.user_id}
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    
    update_data = {k: v for k, v in item_update.dict().items() if v is not None}
    
    if update_data:
        await db.pantry.update_one(
            {"item_id": item_id},
            {"$set": update_data}
        )
    
    updated = await db.pantry.find_one(
        {"item_id": item_id},
        {"_id": 0}
    )
    
    return updated

@pantry_router.delete("/{item_id}")
async def delete_pantry_item(
    item_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a pantry item."""
    result = await db.pantry.delete_one(
        {"item_id": item_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Item deleted successfully"}

@pantry_router.post("/{item_id}/use")
async def use_pantry_item(
    item_id: str,
    use_request: UseItemRequest,
    user: User = Depends(get_current_user)
):
    """Use (subtract) quantity from a pantry item."""
    item = await db.pantry.find_one(
        {"item_id": item_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    new_quantity = item["quantity"] - use_request.quantity
    
    if new_quantity <= 0:
        # Delete item if quantity reaches zero
        await db.pantry.delete_one({"item_id": item_id})
        return {"message": "Item used completely and removed", "remaining": 0}
    
    await db.pantry.update_one(
        {"item_id": item_id},
        {"$set": {
            "quantity": new_quantity,
            "last_used": datetime.now(timezone.utc)
        }}
    )
    
    return {"message": "Item quantity updated", "remaining": new_quantity}

@pantry_router.post("/scan-barcode")
async def scan_barcode(
    request: BarcodeScanRequest,
    user: User = Depends(get_current_user)
):
    """Lookup product information by barcode using OpenFoodFacts API."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://world.openfoodfacts.org/api/v2/product/{request.barcode}.json",
                timeout=10.0
            )
            
            if response.status_code != 200:
                return {"found": False, "message": "Product not found in database"}
            
            data = response.json()
            
            if data.get("status") != 1:
                return {"found": False, "message": "Product not found in database"}
            
            product = data.get("product", {})
            nutriments = product.get("nutriments", {})
            
            return {
                "found": True,
                "item": {
                    "item_name": product.get("product_name", "Unknown Product"),
                    "brand": product.get("brands", ""),
                    "serving_size": product.get("serving_size", ""),
                    "calories_per_unit": nutriments.get("energy-kcal_serving", nutriments.get("energy-kcal_100g", 0)),
                    "protein": nutriments.get("proteins_serving", nutriments.get("proteins_100g", 0)),
                    "carbs": nutriments.get("carbohydrates_serving", nutriments.get("carbohydrates_100g", 0)),
                    "fats": nutriments.get("fat_serving", nutriments.get("fat_100g", 0)),
                    "barcode_id": request.barcode
                }
            }
    except Exception as e:
        logger.error(f"Barcode lookup error: {e}")
        return {"found": False, "message": "Error looking up product"}

@pantry_router.post("/scan-label")
async def scan_nutrition_label(
    request: LabelScanRequest,
    user: User = Depends(get_current_user)
):
    """Use GPT-4o Vision to analyze a nutrition facts label image."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        # Create new chat instance for this request
        chat = LlmChat(
            api_key=api_key,
            session_id=f"pantry_ocr_{uuid.uuid4().hex[:8]}",
            system_message="""You are a nutrition label analyzer. When given an image of a nutrition facts label, 
            extract the following information and return it as valid JSON only:
            {
                "item_name": "product name if visible, otherwise 'Unknown Product'",
                "serving_size": "the serving size text",
                "calories_per_unit": numeric value of calories per serving (number only),
                "protein": numeric value of protein in grams (number only),
                "carbs": numeric value of carbohydrates in grams (number only),
                "fats": numeric value of total fat in grams (number only),
                "brand": "brand name if visible, otherwise empty string"
            }
            Only return the JSON object, no other text, no markdown formatting."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=request.image_base64)
        
        # Create message with image
        user_message = UserMessage(
            text="Please analyze this nutrition facts label and extract the nutritional information.",
            image_contents=[image_content]
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse the JSON response
        try:
            # Clean up response if needed
            response_text = response.strip()
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            
            nutrition_data = json.loads(response_text)
            
            return {
                "success": True,
                "item": {
                    "item_name": nutrition_data.get("item_name", "Unknown Product"),
                    "serving_size": nutrition_data.get("serving_size", ""),
                    "calories_per_unit": float(nutrition_data.get("calories_per_unit", 0)),
                    "protein": float(nutrition_data.get("protein", 0)),
                    "carbs": float(nutrition_data.get("carbs", 0)),
                    "fats": float(nutrition_data.get("fats", 0)),
                    "brand": nutrition_data.get("brand", "")
                }
            }
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {response}")
            return {
                "success": False,
                "message": "Failed to parse nutrition information",
                "raw_response": response
            }
            
    except Exception as e:
        logger.error(f"Label scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing label: {str(e)}")

# ==================== AI CHEF ROUTES ====================

class MealSuggestionRequest(BaseModel):
    count: int = 3  # Number of meals to suggest


# ---------- AI Chef: cook a meal (pantry deduction + meal log) ----------
class CookMealIngredient(BaseModel):
    text: str  # raw ingredient string from the recipe
    quantity: Optional[float] = None  # optional parsed qty
    unit: Optional[str] = None        # optional unit (g, ml, pc, cup...)


class CookMealRequest(BaseModel):
    meal_name: str
    ingredients: List[str]            # raw recipe ingredient strings
    macros: dict                      # { calories, protein, carbs, fats }
    meal_type: Optional[str] = "lunch"
    dry_run: bool = True              # true → preview only, false → apply


def _parse_ingredient(text: str) -> dict:
    """Best-effort parse: '150g chicken breast' → {qty:150, unit:'g', name:'chicken breast'}.

    Handles patterns:
      '150g chicken breast'  '2 cups rice'  '1 tbsp olive oil'  '2 eggs'  'salt'
    Falls back to {qty: 1, unit: '', name: <text>} for anything weird.
    """
    s = (text or "").strip().lower()
    if not s:
        return {"qty": 1, "unit": "", "name": ""}
    # Try: number unit name  OR  number name
    m = re.match(r"^([\d.,/]+)\s*([a-z]+)?\s+(.+)$", s)
    qty = 1.0
    unit = ""
    name = s
    if m:
        raw_n = m.group(1).replace(",", ".")
        try:
            # very rough fraction support 1/2 etc.
            if "/" in raw_n:
                a, b = raw_n.split("/", 1)
                qty = float(a) / float(b)
            else:
                qty = float(raw_n)
        except Exception:
            qty = 1.0
        unit = (m.group(2) or "").strip()
        name = (m.group(3) or s).strip()
        # If "unit" is actually part of the food name (e.g. "2 eggs"), unmark it
        if unit and unit not in {"g", "kg", "ml", "l", "tsp", "tbsp", "cup", "cups", "oz", "lb", "pc", "piece", "pieces", "slice", "slices"}:
            name = f"{unit} {name}".strip()
            unit = ""
    # Strip parenthetical hints
    name = re.sub(r"\s*\([^)]*\)", "", name).strip()
    return {"qty": qty, "unit": unit, "name": name}


def _match_pantry_item(parsed_name: str, pantry: List[dict]) -> Optional[dict]:
    """Find the best pantry item for a parsed ingredient name (token-overlap).

    Returns the pantry doc or None.
    """
    if not parsed_name or not pantry:
        return None
    tokens = set(re.findall(r"[a-z]{3,}", parsed_name.lower()))
    if not tokens:
        return None
    best = None
    best_score = 0
    for p in pantry:
        pn = (p.get("item_name") or p.get("name") or "").lower()
        p_tokens = set(re.findall(r"[a-z]{3,}", pn))
        overlap = len(tokens & p_tokens)
        if overlap > best_score and overlap > 0:
            best = p
            best_score = overlap
    return best


@pantry_router.post("/cook-meal")
async def cook_meal(
    req: CookMealRequest,
    user: User = Depends(get_current_user),
):
    """Match recipe ingredients against pantry. In `dry_run` returns a preview
    (matched + unmatched). With `dry_run=false`, deducts the matched items
    from pantry and logs the meal to today's nutrition log.
    """
    pantry = await db.pantry.find({"user_id": user.user_id}, {"_id": 0}).to_list(200)
    matched: List[dict] = []
    unmatched: List[dict] = []
    for raw in req.ingredients:
        parsed = _parse_ingredient(raw)
        if not parsed["name"]:
            continue
        hit = _match_pantry_item(parsed["name"], pantry)
        if hit:
            # Determine deduction qty — if pantry stores grams and parsed unit is g/ml,
            # subtract parsed qty; otherwise subtract 1 unit.
            p_unit = (hit.get("unit") or "").lower()
            i_unit = (parsed.get("unit") or "").lower()
            deduction = parsed["qty"]
            if p_unit and i_unit and p_unit != i_unit:
                # Unit mismatch → fall back to 1 unit of pantry inventory
                deduction = 1
            elif not i_unit:
                deduction = 1
            # Don't deduct more than what's available
            available = float(hit.get("quantity") or 0)
            deduct_final = min(deduction, available) if available > 0 else deduction
            matched.append({
                "raw": raw,
                "parsed_name": parsed["name"],
                "pantry_item_id": hit.get("item_id"),
                "pantry_name": hit.get("item_name") or hit.get("name"),
                "pantry_unit": hit.get("unit"),
                "available": available,
                "deduct": round(deduct_final, 2),
                "after": round(max(0.0, available - deduct_final), 2),
            })
        else:
            unmatched.append({
                "raw": raw,
                "parsed_name": parsed["name"],
                "quantity": parsed["qty"],
                "unit": parsed["unit"],
            })

    if req.dry_run:
        return {
            "success": True,
            "dry_run": True,
            "matched": matched,
            "unmatched": unmatched,
        }

    # Apply: deduct each matched + log meal
    for m in matched:
        if not m.get("pantry_item_id"):
            continue
        new_qty = max(0.0, m["available"] - m["deduct"])
        if new_qty <= 0:
            await db.pantry.delete_one({"item_id": m["pantry_item_id"]})
        else:
            await db.pantry.update_one(
                {"item_id": m["pantry_item_id"]},
                {"$set": {"quantity": new_qty, "last_used": datetime.now(timezone.utc)}},
            )

    # Log meal
    mtype = (req.meal_type or "lunch").lower()
    item = {
        "item_id": f"chef_{uuid.uuid4().hex[:10]}",
        "name": req.meal_name,
        "calories": float(req.macros.get("calories") or 0),
        "protein": float(req.macros.get("protein") or 0),
        "carbs": float(req.macros.get("carbs") or 0),
        "fats": float(req.macros.get("fats") or 0),
        "quantity": 1,
        "unit": "serving",
    }
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meal_doc = {
        "meal_id": f"meal_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "date": today_str,
        "meal_type": mtype,
        "items": [item],
        "total_calories": item["calories"],
        "total_protein": item["protein"],
        "total_carbs": item["carbs"],
        "total_fats": item["fats"],
        "source": "ai_chef",
        "created_at": datetime.now(timezone.utc),
    }
    await db.meals.insert_one(meal_doc)

    return {
        "success": True,
        "dry_run": False,
        "matched": matched,
        "unmatched": unmatched,
        "meal_logged": True,
    }


# ---------- Coach: calorie-goal adjustment based on weight trend ----------
@coach_router.get("/calorie-adjustment")
async def coach_calorie_adjustment(user: User = Depends(get_current_user)):
    """If the user is on lose_fat/build_muscle and their weight has stalled
    for 21 days (Δ ≤ 0.3 kg), suggest a new calorie target.
    """
    if not user.goal_type or user.goal_type not in {"lose_fat", "build_muscle", "maintain"}:
        return {"suggestion": None}

    # Normalize datetimes to naive UTC for comparison (Mongo stores naive)
    def _naive(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if dt.tzinfo else dt

    # Use 22-day cutoff to safely include measurements taken ~21 days ago
    # (avoids off-by-one when client and server clocks differ slightly).
    cutoff = (datetime.now(timezone.utc) - timedelta(days=22)).replace(tzinfo=None)
    weights = await db.measurements.find(
        {"user_id": user.user_id, "weight_kg": {"$ne": None}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(60)
    if len(weights) < 2:
        return {"suggestion": None}

    latest = weights[0]
    latest_ts = _naive(latest.get("created_at"))
    earliest_in_window = None
    earliest_ts = None
    for w in weights:
        wts = _naive(w.get("created_at"))
        if wts and wts < cutoff:
            break
        earliest_in_window = w
        earliest_ts = wts
    if not earliest_in_window or earliest_ts is None or latest_ts is None:
        return {"suggestion": None}
    span_days = (latest_ts - earliest_ts).days
    if span_days < 18:
        return {"suggestion": None}

    delta = float(latest["weight_kg"]) - float(earliest_in_window["weight_kg"])

    # For lose_fat / build_muscle: trigger when stalled (|Δ| ≤ 0.3kg)
    # For maintain: trigger when fluctuating > 1kg either direction
    if user.goal_type in {"lose_fat", "build_muscle"} and abs(delta) > 0.3:
        return {"suggestion": None}
    if user.goal_type == "maintain" and abs(delta) <= 1.0:
        return {"suggestion": None}

    # Recompute TDEE from current weight + existing user inputs
    if not all([user.height_cm, user.age, user.biological_sex, user.activity_level]):
        return {"suggestion": None}
    new_weight = float(latest["weight_kg"])
    new_tdee = calculate_tdee(new_weight, user.height_cm, user.age, user.biological_sex, user.activity_level)

    if user.goal_type == "lose_fat":
        proposed_calories = max(1200, new_tdee - 500)
        direction = "reduce"
        copy = (
            f"Your progress has slowed. Based on your current weight of "
            f"{new_weight:.1f}kg your new maintenance is approximately {new_tdee} cal. "
            f"Would you like to reduce your calorie goal to {proposed_calories} cal to continue losing weight?"
        )
    elif user.goal_type == "build_muscle":
        proposed_calories = new_tdee + 250 + 100  # small bump of 100–150 above the previous surplus
        direction = "increase"
        copy = (
            f"You're not gaining weight. Based on your current weight of "
            f"{new_weight:.1f}kg your new maintenance is approximately {new_tdee} cal. "
            f"Would you like to increase your calorie goal to {proposed_calories} cal to continue building muscle?"
        )
    else:  # maintain — weight is drifting; align to actual TDEE
        proposed_calories = new_tdee
        if delta > 0:
            direction = "reduce"
            trend_copy = f"you've gained {delta:.1f}kg"
        else:
            direction = "increase"
            trend_copy = f"you've lost {abs(delta):.1f}kg"
        copy = (
            f"Your weight has been fluctuating — in the last 21 days {trend_copy}. "
            f"Based on your current weight of {new_weight:.1f}kg your new maintenance is "
            f"approximately {new_tdee} cal. Would you like to update your calorie goal to "
            f"{proposed_calories} cal to match your actual TDEE?"
        )

    protein, carbs, fats = calculate_macros(new_weight, new_tdee, proposed_calories)
    return {
        "suggestion": {
            "direction": direction,
            "goal_type": user.goal_type,
            "current_weight_kg": new_weight,
            "current_calorie_goal": user.goal_calories,
            "current_tdee": user.tdee or new_tdee,
            "new_tdee": new_tdee,
            "proposed_calories": proposed_calories,
            "proposed_protein": protein,
            "proposed_carbs": carbs,
            "proposed_fats": fats,
            "copy": copy,
            "delta_kg_21d": round(delta, 2),
        }
    }


class ApplyAdjustmentRequest(BaseModel):
    calories: int
    protein: int
    carbs: int
    fats: int
    tdee: Optional[float] = None
    weight_kg: Optional[float] = None


@coach_router.post("/apply-calorie-adjustment")
async def apply_calorie_adjustment(
    req: ApplyAdjustmentRequest,
    user: User = Depends(get_current_user),
):
    """Apply the suggested calorie/macro adjustment to the user's profile."""
    patch = {
        "goal_calories": int(req.calories),
        "goal_protein": int(req.protein),
        "goal_carbs": int(req.carbs),
        "goal_fats": int(req.fats),
    }
    if req.tdee:
        patch["tdee"] = float(req.tdee)
    if req.weight_kg:
        patch["weight_kg"] = float(req.weight_kg)
    await db.users.update_one({"user_id": user.user_id}, {"$set": patch})
    return {"success": True, **patch}



# ---------- Shopping List ----------
class ShoppingListItemCreate(BaseModel):
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    source: Optional[str] = None  # 'ai_chef', 'manual', etc.


class ShoppingListBulkCreate(BaseModel):
    items: List[ShoppingListItemCreate]


@shopping_router.get("")
async def list_shopping_items(user: User = Depends(get_current_user)):
    items = await db.shopping_list.find(
        {"user_id": user.user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return {"items": items}


@shopping_router.post("")
async def add_shopping_item(req: ShoppingListItemCreate, user: User = Depends(get_current_user)):
    name_clean = (req.name or "").strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Item name required")
    # De-dupe by name (case-insensitive) — bump quantity if already exists & unchecked
    existing = await db.shopping_list.find_one({
        "user_id": user.user_id,
        "name_lower": name_clean.lower(),
        "checked": False,
    })
    if existing:
        return {"success": True, "item": {**existing, "_id": str(existing.get("_id", ""))}, "deduped": True}

    item = {
        "item_id": f"sl_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "name": name_clean,
        "name_lower": name_clean.lower(),
        "quantity": req.quantity,
        "unit": req.unit,
        "source": req.source or "manual",
        "checked": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.shopping_list.insert_one(item)
    return {"success": True, "item": {k: v for k, v in item.items() if k != "_id"}}


@shopping_router.post("/bulk")
async def bulk_add_shopping_items(req: ShoppingListBulkCreate, user: User = Depends(get_current_user)):
    added = 0
    for it in req.items:
        name_clean = (it.name or "").strip()
        if not name_clean:
            continue
        existing = await db.shopping_list.find_one({
            "user_id": user.user_id,
            "name_lower": name_clean.lower(),
            "checked": False,
        })
        if existing:
            continue
        await db.shopping_list.insert_one({
            "item_id": f"sl_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id,
            "name": name_clean,
            "name_lower": name_clean.lower(),
            "quantity": it.quantity,
            "unit": it.unit,
            "source": it.source or "ai_chef",
            "checked": False,
            "created_at": datetime.now(timezone.utc),
        })
        added += 1
    return {"success": True, "added": added}


@shopping_router.put("/{item_id}/toggle")
async def toggle_shopping_item(item_id: str, user: User = Depends(get_current_user)):
    existing = await db.shopping_list.find_one({"user_id": user.user_id, "item_id": item_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Item not found")
    new_state = not bool(existing.get("checked", False))
    await db.shopping_list.update_one(
        {"item_id": item_id, "user_id": user.user_id},
        {"$set": {"checked": new_state, "checked_at": datetime.now(timezone.utc) if new_state else None}},
    )
    return {"success": True, "checked": new_state}


@shopping_router.delete("/{item_id}")
async def delete_shopping_item(item_id: str, user: User = Depends(get_current_user)):
    res = await db.shopping_list.delete_one({"user_id": user.user_id, "item_id": item_id})
    return {"success": True, "deleted": res.deleted_count}


@shopping_router.delete("/clear/checked")
async def clear_checked_items(user: User = Depends(get_current_user)):
    res = await db.shopping_list.delete_many({"user_id": user.user_id, "checked": True})
    return {"success": True, "deleted": res.deleted_count}



@pantry_router.post("/ai-chef/suggest")
async def get_ai_meal_suggestions(
    request: MealSuggestionRequest,
    user: User = Depends(get_current_user)
):
    """Use AI to suggest meals based on pantry items and remaining macros."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json
        
        # Get pantry items
        pantry_items = await db.pantry.find(
            {"user_id": user.user_id},
            {"_id": 0}
        ).to_list(50)
        
        if not pantry_items:
            return {
                "success": False,
                "message": "No items in pantry. Add some items first!"
            }
        
        # Get today's nutrition data
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        meals = await db.meals.find(
            {"user_id": user.user_id, "date": today},
            {"_id": 0}
        ).to_list(100)
        
        # Calculate consumed
        consumed_cal = sum(m.get("total_calories", 0) for m in meals)
        consumed_p = sum(m.get("total_protein", 0) for m in meals)
        consumed_c = sum(m.get("total_carbs", 0) for m in meals)
        consumed_f = sum(m.get("total_fats", 0) for m in meals)
        
        # Get user goals
        user_doc = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0}
        )
        
        goal_cal = user_doc.get("goal_calories", 2200)
        goal_p = user_doc.get("goal_protein", 150)
        goal_c = user_doc.get("goal_carbs", 250)
        goal_f = user_doc.get("goal_fats", 70)
        
        # Calculate remaining
        rem_cal = max(0, goal_cal - consumed_cal)
        rem_p = max(0, goal_p - consumed_p)
        rem_c = max(0, goal_c - consumed_c)
        rem_f = max(0, goal_f - consumed_f)
        
        # Build pantry list with full details
        pantry_list = ", ".join([
            f"{item['item_name']} ({item['quantity']}{item['unit']}, {item['calories_per_unit']}cal, {item['protein']}g P)"
            for item in pantry_items[:15]  # Limit to 15 items
        ])
        
        # Build enhanced recipe prompt
        prompt = f"""Goal: Suggest {request.count} complete recipes using [Pantry] to fit {int(rem_cal)}kcal.

Rules:
1. "n": Meal Name.
2. "i": Exact ingredients used from [Pantry] with quantities.
3. "r": Full step-by-step cooking instructions. Be thorough but concise.
4. "m": Macros object {{p: protein, c: carbs, f: fat, k: calories}}.
5. "t": Total prep/cook time in minutes.
6. Output: Strict raw JSON only.

Inputs:
Pantry: {pantry_list}
Remaining Today: {int(rem_cal)}kcal, {int(rem_p)}g P, {int(rem_c)}g C, {int(rem_f)}g F.

Template:
{{"meals": [{{"n": "", "i": [], "r": [], "m": {{"p":0,"c":0,"f":0,"k":0}}, "t": 0}}]}}"""

        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ai_chef_{uuid.uuid4().hex[:8]}",
            system_message="You are an AI Chef. Return only valid JSON, no markdown or explanations."
        ).with_model("openai", "gpt-4o")
        
        from emergentintegrations.llm.chat import UserMessage
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        try:
            suggestions = json.loads(response_text)
            
            # Transform to more readable format (handle both old and new format)
            meals = []
            meal_list = suggestions.get("meals", suggestions.get("m", []))
            
            for meal in meal_list:
                meals.append({
                    "name": meal.get("n", meal.get("name", "Meal")),
                    "ingredients": meal.get("i", meal.get("ingredients", [])),
                    "recipe": meal.get("r", meal.get("recipe", [])),  # Step-by-step instructions
                    "cook_time": meal.get("t", meal.get("cook_time", 0)),  # Minutes
                    "macros": {
                        "protein": meal.get("m", meal.get("ma", meal.get("macros", {}))).get("p", meal.get("m", {}).get("protein", 0)),
                        "carbs": meal.get("m", meal.get("ma", meal.get("macros", {}))).get("c", meal.get("m", {}).get("carbs", 0)),
                        "fats": meal.get("m", meal.get("ma", meal.get("macros", {}))).get("f", meal.get("m", {}).get("fats", 0)),
                        "calories": meal.get("m", meal.get("ma", meal.get("macros", {}))).get("k", meal.get("m", {}).get("calories", 0))
                    }
                })
            
            return {
                "success": True,
                "meals": meals,
                "remaining": {
                    "calories": int(rem_cal),
                    "protein": int(rem_p),
                    "carbs": int(rem_c),
                    "fats": int(rem_f)
                },
                "pantry_items_used": len(pantry_items)
            }
            
        except json.JSONDecodeError:
            logger.error(f"Failed to parse AI Chef response: {response_text}")
            return {
                "success": False,
                "message": "AI returned invalid response. Please try again.",
                "raw": response_text
            }
            
    except Exception as e:
        logger.error(f"AI Chef error: {e}")
        
        # Check if it's a budget exceeded error and provide helpful message
        if "Budget has been exceeded" in str(e):
            return {
                "success": False,
                "message": "AI service temporarily unavailable due to budget limits. Please try again later.",
                "error_type": "budget_exceeded"
            }
        
        raise HTTPException(status_code=500, detail=f"Error generating suggestions: {str(e)}")

# ==================== MEAL IMAGE ANALYSIS ====================

class MealImageAnalysisRequest(BaseModel):
    image_base64: str
    recent_recipe: Optional[dict] = None  # Last generated AI Chef recipe

@pantry_router.post("/analyze-meal")
async def analyze_meal_image(
    request: MealImageAnalysisRequest,
    user: User = Depends(get_current_user)
):
    """Use GPT-4o Vision to analyze a meal photo with high precision using pantry data."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import json
        
        # Get user's pantry data
        pantry_items = await db.pantry.find(
            {"user_id": user.user_id},
            {"_id": 0}
        ).to_list(50)
        
        # Build pantry JSON for the prompt
        pantry_json = [
            {
                "name": item["item_name"],
                "per_100g": {
                    "calories": round(item["calories_per_unit"], 1),
                    "protein": round(item["protein"], 1),
                    "carbs": round(item["carbs"], 1),
                    "fats": round(item["fats"], 1)
                }
            }
            for item in pantry_items
        ]
        
        # Format recent recipe if provided
        recipe_context = ""
        if request.recent_recipe:
            recipe_context = f"""
Recent Recipe: {json.dumps(request.recent_recipe)}"""
        
        # Get user's daily goal
        user_doc = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0}
        )
        daily_target = user_doc.get("goal_calories", 2200)
        
        # Build the precision prompt
        prompt = f"""Goal: Extract precise macros from this meal image.

Step 1 [Identification]: Identify every ingredient. Cross-reference with the [User Pantry List] provided. If a match is found, use those exact per-100g macros.
Step 2 [Volume/Mass]: Use the reference object (fork/hand/plate edge) to estimate the weight of each item in grams (g). 
Step 3 [Recipe Sync]: If this image matches the "AI Chef Recipe" recently generated, prioritize the recipe's known raw weights but adjust for visible "leftovers" or "extra portions."

Rules:
1. Output: Strict raw JSON only.
2. Logic: (Weight_g / 100) * Pantry_Macro_Value.
3. Constraint: If confidence is <92%, flag the "uncertain_items".

Inputs:
Pantry Data: {json.dumps(pantry_json)}
{recipe_context}
Target: {daily_target}kcal daily limit.

Template:
{{
  "confidence_score": 0.92,
  "total_m": {{"p":0, "c":0, "f":0, "k":0}},
  "breakdown": [{{"item": "", "weight_g": 0, "source": "pantry|global_avg"}}],
  "uncertain_items": []
}}"""

        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"meal_analysis_{uuid.uuid4().hex[:8]}",
            system_message="You are a High-Precision Nutrition Radiologist. Your goal is 92%+ accuracy. Do not use generic averages if a specific pantry item is provided. Use the 'Hand/Fork' in the image as a scale for 3D volume estimation. Return only valid JSON, no markdown."
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=request.image_base64)
        
        # Create message with image
        user_message = UserMessage(
            text=prompt,
            image_contents=[image_content]
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse response
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        response_text = response_text.strip()
        
        try:
            analysis = json.loads(response_text)
            
            # Extract and format the response
            confidence = analysis.get("confidence_score", 0.85)
            total_macros = analysis.get("total_m", {})
            breakdown = analysis.get("breakdown", [])
            uncertain = analysis.get("uncertain_items", [])
            
            return {
                "success": True,
                "confidence_score": confidence,
                "high_confidence": confidence >= 0.92,
                "total_macros": {
                    "protein": total_macros.get("p", 0),
                    "carbs": total_macros.get("c", 0),
                    "fats": total_macros.get("f", 0),
                    "calories": total_macros.get("k", 0)
                },
                "breakdown": [
                    {
                        "item": item.get("item", "Unknown"),
                        "weight_g": item.get("weight_g", 0),
                        "source": item.get("source", "global_avg"),
                        "macros": {
                            "protein": round(item.get("weight_g", 0) / 100 * next(
                                (p["per_100g"]["protein"] for p in pantry_json if p["name"].lower() in item.get("item", "").lower()), 
                                item.get("protein", 0)
                            ), 1),
                            "carbs": round(item.get("weight_g", 0) / 100 * next(
                                (p["per_100g"]["carbs"] for p in pantry_json if p["name"].lower() in item.get("item", "").lower()), 
                                item.get("carbs", 0)
                            ), 1),
                            "fats": round(item.get("weight_g", 0) / 100 * next(
                                (p["per_100g"]["fats"] for p in pantry_json if p["name"].lower() in item.get("item", "").lower()), 
                                item.get("fats", 0)
                            ), 1),
                        }
                    }
                    for item in breakdown
                ],
                "uncertain_items": uncertain,
                "pantry_matches": sum(1 for item in breakdown if item.get("source") == "pantry")
            }
            
        except json.JSONDecodeError:
            logger.error(f"Failed to parse meal analysis response: {response_text}")
            return {
                "success": False,
                "message": "Failed to analyze meal image. Please try again.",
                "raw": response_text
            }
            
    except Exception as e:
        logger.error(f"Meal analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing meal: {str(e)}")

@nutrition_router.post("/log-from-analysis")
async def log_meal_from_analysis(
    analysis_data: dict,
    meal_type: str = "lunch",
    user: User = Depends(get_current_user)
):
    """Log a meal directly from image analysis results."""
    try:
        # Build meal items from analysis breakdown
        items = []
        for item in analysis_data.get("breakdown", []):
            items.append({
                "item_id": f"mi_{uuid.uuid4().hex[:12]}",
                "name": item.get("item", "Unknown"),
                "calories": item.get("macros", {}).get("calories", 0),
                "protein": item.get("macros", {}).get("protein", 0),
                "carbs": item.get("macros", {}).get("carbs", 0),
                "fats": item.get("macros", {}).get("fats", 0),
                "quantity": 1,
                "unit": f"{item.get('weight_g', 0)}g"
            })
        
        total_macros = analysis_data.get("total_macros", {})
        
        meal = Meal(
            user_id=user.user_id,
            meal_type=meal_type,
            items=items,
            total_calories=total_macros.get("calories", 0),
            total_protein=total_macros.get("protein", 0),
            total_carbs=total_macros.get("carbs", 0),
            total_fats=total_macros.get("fats", 0)
        )
        
        await db.meals.insert_one(meal.dict())
        
        return {
            "success": True,
            "meal": meal.dict(),
            "message": "Meal logged successfully!"
        }
        
    except Exception as e:
        logger.error(f"Error logging meal from analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Error logging meal: {str(e)}")

# ==================== EXERCISE LIBRARY ====================

EXERCISE_LIBRARY = {
    "chest": [
        "Bench Press", "Incline Bench Press", "Decline Bench Press", "Dumbbell Bench Press",
        "Incline Dumbbell Press", "Dumbbell Fly", "Cable Fly", "Pec Deck", "Push Up",
        "Diamond Push Up", "Wide Push Up", "Chest Dip", "Machine Chest Press",
        "Landmine Press", "Floor Press", "Svend Press"
    ],
    "back": [
        "Deadlift", "Barbell Row", "Dumbbell Row", "Pendlay Row", "T-Bar Row",
        "Cable Row", "Lat Pulldown", "Pull Up", "Chin Up", "Assisted Pull Up",
        "Face Pull", "Straight Arm Pulldown", "Shrug", "Rack Pull", "Good Morning",
        "Hyperextension", "Reverse Fly", "Inverted Row", "Meadows Row"
    ],
    "shoulders": [
        "Overhead Press", "Military Press", "Dumbbell Shoulder Press", "Arnold Press",
        "Lateral Raise", "Front Raise", "Rear Delt Fly", "Upright Row",
        "Cable Lateral Raise", "Machine Shoulder Press", "Push Press",
        "Behind Neck Press", "Bradford Press", "Lu Raise", "Y Raise"
    ],
    "arms": [
        "Barbell Curl", "Dumbbell Curl", "Hammer Curl", "Preacher Curl", "EZ Bar Curl",
        "Concentration Curl", "Cable Curl", "Spider Curl", "Incline Curl", "21s",
        "Tricep Pushdown", "Overhead Tricep Extension", "Skull Crusher", "Close Grip Bench",
        "Tricep Dip", "Diamond Push Up", "Kickback", "JM Press", "Tate Press",
        "Wrist Curl", "Reverse Curl", "Farmer Walk"
    ],
    "legs": [
        "Squat", "Front Squat", "Leg Press", "Hack Squat", "Goblet Squat",
        "Bulgarian Split Squat", "Lunge", "Walking Lunge", "Step Up", "Box Jump",
        "Leg Extension", "Leg Curl", "Romanian Deadlift", "Stiff Leg Deadlift",
        "Sumo Deadlift", "Hip Thrust", "Glute Bridge", "Cable Pull Through",
        "Good Morning", "Nordic Curl", "Sissy Squat", "Calf Raise", "Seated Calf Raise"
    ],
    "core": [
        "Plank", "Side Plank", "Crunch", "Sit Up", "Russian Twist", "Leg Raise",
        "Hanging Leg Raise", "Ab Wheel Rollout", "Cable Crunch", "Pallof Press",
        "Dead Bug", "Bird Dog", "Mountain Climber", "Bicycle Crunch",
        "Toe Touch", "V Up", "Dragon Flag", "L Sit", "Hollow Hold"
    ],
    "cardio": [
        "Running", "Treadmill", "Cycling", "Stationary Bike", "Rowing Machine",
        "Elliptical", "Stair Climber", "Jump Rope", "Swimming", "Battle Ropes",
        "Burpee", "Box Jump", "Jumping Jack", "High Knees", "Mountain Climber",
        "Assault Bike", "Sprints", "HIIT", "Walking"
    ]
}

@exercise_router.get("/library")
async def get_exercise_library():
    """Get the full exercise library organized by muscle group."""
    return {
        "library": EXERCISE_LIBRARY,
        "total_exercises": sum(len(exercises) for exercises in EXERCISE_LIBRARY.values())
    }

@exercise_router.get("/library/search")
async def search_exercises(
    q: str = "",
    muscle_group: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Search exercises by name or filter by muscle group."""
    results = []
    
    for group, exercises in EXERCISE_LIBRARY.items():
        if muscle_group and group != muscle_group:
            continue
        for exercise in exercises:
            if not q or q.lower() in exercise.lower():
                results.append({
                    "name": exercise,
                    "muscle_group": group
                })
    
    # Also get user's custom exercises
    user_exercises = await db.workouts.aggregate([
        {"$match": {"user_id": user.user_id}},
        {"$unwind": "$exercises"},
        {"$group": {"_id": "$exercises.exercise_name"}},
        {"$limit": 50}
    ]).to_list(50)
    
    for ex in user_exercises:
        name = ex["_id"]
        # Check if not already in library
        is_in_library = any(name.lower() == e.lower() for exercises in EXERCISE_LIBRARY.values() for e in exercises)
        if not is_in_library and (not q or q.lower() in name.lower()):
            results.append({
                "name": name,
                "muscle_group": "custom"
            })
    
    return {"exercises": results[:50]}

# ============= FREE-EXERCISE-DB LOOKUP =============
# Loaded once at startup for fast in-memory lookups.
import json as _json
_FED_PATH = Path(__file__).parent / "data" / "exercises.json"
try:
    with open(_FED_PATH, "r") as _f:
        FREE_EXERCISE_DB: List[dict] = _json.load(_f)
except Exception as _e:
    FREE_EXERCISE_DB = []
    logger.warning(f"Could not load free-exercise-db: {_e}")

FED_BASE_URL = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises"

# Build a fast index by lowercased name and normalized name
def _norm(s: str) -> str:
    return "".join(c.lower() for c in s if c.isalnum())

_FED_INDEX = {}
for _ex in FREE_EXERCISE_DB:
    _name = _ex.get("name", "")
    _FED_INDEX[_norm(_name)] = _ex
    # also index by id (replace _ with space)
    _FED_INDEX[_norm(_ex.get("id", ""))] = _ex

def _find_fed(name: str) -> Optional[dict]:
    """Find a matching exercise in free-exercise-db using fuzzy logic."""
    if not name or not FREE_EXERCISE_DB:
        return None
    n = _norm(name)
    if n in _FED_INDEX:
        return _FED_INDEX[n]
    # Try partial matches: longest substring match
    candidates = []
    for key, val in _FED_INDEX.items():
        if n in key or key in n:
            # score by overlap length
            overlap = min(len(n), len(key))
            candidates.append((overlap, val))
    if candidates:
        candidates.sort(key=lambda x: -x[0])
        return candidates[0][1]
    # Token-based: at least 2 tokens must match
    name_tokens = set(name.lower().replace("-", " ").split())
    name_tokens.discard("")
    best = None
    best_score = 0
    for ex in FREE_EXERCISE_DB:
        ex_tokens = set(ex.get("name", "").lower().replace("-", " ").split())
        score = len(name_tokens & ex_tokens)
        if score > best_score and score >= 2:
            best_score = score
            best = ex
    return best


# Map free-exercise-db muscle names → react-native-body-highlighter slugs
FED_TO_BODY_MUSCLE = {
    "abdominals": "abs",
    "abductors": "gluteal",
    "adductors": "adductors",
    "biceps": "biceps",
    "calves": "calves",
    "chest": "chest",
    "forearms": "forearm",
    "glutes": "gluteal",
    "hamstrings": "hamstring",
    "lats": "upper-back",
    "lower back": "lower-back",
    "middle back": "upper-back",
    "neck": "neck",
    "quadriceps": "quadriceps",
    "shoulders": "deltoids",
    "traps": "trapezius",
    "triceps": "triceps",
}


def _to_body_muscles(fed_muscles: List[str], intensity: int) -> List[dict]:
    """Convert free-exercise-db muscle list to body-highlighter format."""
    out = []
    seen = set()
    for m in fed_muscles or []:
        slug = FED_TO_BODY_MUSCLE.get(m.lower())
        if slug and slug not in seen:
            out.append({"slug": slug, "intensity": intensity})
            seen.add(slug)
    return out


@exercise_router.get("/details")
async def exercise_details(name: str):
    """Look up an exercise's GIF frames, muscles worked, and instructions.

    Source priority:
      1. free-exercise-db (gives 2-frame image set + primary/secondary muscles)
      2. Fallback: YouTube search URL for "<name> proper form"

    Returns:
      {
        "name": str,
        "matched_name": str | None,
        "source": "free-exercise-db" | "youtube",
        "frames": [url, url],            # 2 image URLs to alternate (free-exercise-db only)
        "primary_muscles": [{slug, intensity}, ...],   # body-highlighter format, intensity=2
        "secondary_muscles": [{slug, intensity}, ...], # body-highlighter format, intensity=1
        "instructions": [str, ...] | None,
        "youtube_search_url": str,        # always present — fallback link
        "youtube_embed_url": str,         # for inline WebView player
        "equipment": str | None,
        "level": str | None,
      }
    """
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    fed = _find_fed(name)
    yt_query = f"{name} proper form".replace(" ", "+")
    youtube_search_url = f"https://www.youtube.com/results?search_query={yt_query}"
    youtube_embed_url = f"https://www.youtube.com/embed?listType=search&list={yt_query}"

    if fed:
        frames = [f"{FED_BASE_URL}/{img}" for img in (fed.get("images") or [])]
        primary = _to_body_muscles(fed.get("primaryMuscles", []), intensity=2)
        secondary = _to_body_muscles(fed.get("secondaryMuscles", []), intensity=1)
        return {
            "name": name,
            "matched_name": fed.get("name"),
            "source": "free-exercise-db",
            "frames": frames,
            "primary_muscles": primary,
            "secondary_muscles": secondary,
            "instructions": fed.get("instructions"),
            "youtube_search_url": youtube_search_url,
            "youtube_embed_url": youtube_embed_url,
            "equipment": fed.get("equipment"),
            "level": fed.get("level"),
            "category": fed.get("category"),
        }

    # Fallback — no frames, just YouTube
    return {
        "name": name,
        "matched_name": None,
        "source": "youtube",
        "frames": [],
        "primary_muscles": [],
        "secondary_muscles": [],
        "instructions": None,
        "youtube_search_url": youtube_search_url,
        "youtube_embed_url": youtube_embed_url,
        "equipment": None,
        "level": None,
        "category": None,
    }


@exercise_router.get("/muscles-thumbnail")
async def exercise_muscles_thumbnail(name: str):
    """Return just the muscle data (primary/secondary) for thumbnail use.
    Lighter response for list views.
    """
    fed = _find_fed(name) if name else None
    if not fed:
        return {"primary_muscles": [], "secondary_muscles": []}
    return {
        "primary_muscles": _to_body_muscles(fed.get("primaryMuscles", []), intensity=2),
        "secondary_muscles": _to_body_muscles(fed.get("secondaryMuscles", []), intensity=1),
    }


# ==================== ONBOARDING ROUTES ====================

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "lightly_active": 1.375,
    "moderately_active": 1.55,
    "very_active": 1.725,
    "extra_active": 1.9
}

GOAL_ADJUSTMENTS = {
    "lose_fat": -400,
    "maintain": 0,
    "build_muscle": 250
}

def calculate_macros(weight_kg: float, tdee: float, goal_calories: int):
    """Calculate macro targets based on goals."""
    protein = round(weight_kg * 2.0)  # 2g per kg
    fat_calories = goal_calories * 0.25
    fat = round(fat_calories / 9)
    remaining_calories = goal_calories - (protein * 4) - fat_calories
    carbs = round(remaining_calories / 4)
    return protein, carbs, fat

@onboarding_router.post("/complete")
async def complete_onboarding(
    data: OnboardingData,
    user: User = Depends(get_current_user)
):
    """Complete user onboarding and calculate TDEE."""
    # Calculate BMR using Mifflin-St Jeor
    if data.biological_sex == "male":
        bmr = (10 * data.weight_kg) + (6.25 * data.height_cm) - (5 * data.age) + 5
    else:
        bmr = (10 * data.weight_kg) + (6.25 * data.height_cm) - (5 * data.age) - 161
    
    # Calculate TDEE
    multiplier = ACTIVITY_MULTIPLIERS.get(data.activity_level, 1.55)
    tdee = bmr * multiplier
    
    # Adjust for goal
    goal_adjustment = GOAL_ADJUSTMENTS.get(data.goal_type, 0)
    goal_calories = round(tdee + goal_adjustment)
    
    # Calculate macros
    protein, carbs, fats = calculate_macros(data.weight_kg, tdee, goal_calories)
    
    # Update user
    update_data = {
        "name": data.name,
        "age": data.age,
        "biological_sex": data.biological_sex,
        "height_cm": data.height_cm,
        "weight_kg": data.weight_kg,
        "activity_level": data.activity_level,
        "goal_type": data.goal_type,
        "sport": data.sport,
        "bmr": round(bmr),
        "tdee": round(tdee),
        "goal_calories": goal_calories,
        "goal_protein": protein,
        "goal_carbs": carbs,
        "goal_fats": fats,
        "onboarding_complete": True
    }
    # Only set training schedule fields if explicitly provided (preserves existing values otherwise)
    if data.training_days_per_week is not None:
        update_data["training_days_per_week"] = data.training_days_per_week
    if data.split_id is not None:
        update_data["split_id"] = data.split_id
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": update_data}
    )
    
    # Create initial body measurement
    measurement = BodyMeasurement(
        user_id=user.user_id,
        weight_kg=data.weight_kg
    )
    await db.measurements.insert_one(measurement.dict())
    
    return {
        "success": True,
        "bmr": round(bmr),
        "tdee": round(tdee),
        "goal_calories": goal_calories,
        "macros": {
            "protein": protein,
            "carbs": carbs,
            "fats": fats
        }
    }

@onboarding_router.get("/status")
async def get_onboarding_status(user: User = Depends(get_current_user)):
    """Check if user has completed onboarding."""
    user_doc = await db.users.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    return {
        "onboarding_complete": user_doc.get("onboarding_complete", False)
    }

# ==================== MEASUREMENTS ROUTES ====================

@measurements_router.get("")
async def get_measurements(
    limit: int = 30,
    user: User = Depends(get_current_user)
):
    """Get user's body measurements history."""
    measurements = await db.measurements.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("date", -1).to_list(limit)
    return {"measurements": measurements}

@measurements_router.post("")
async def add_measurement(
    measurement_data: dict,
    user: User = Depends(get_current_user)
):
    """Add a new body measurement."""
    measurement = BodyMeasurement(
        user_id=user.user_id,
        **measurement_data
    )
    await db.measurements.insert_one(measurement.dict())
    return measurement.dict()

@measurements_router.get("/weight")
async def get_weight_history(
    days: int = 30,
    user: User = Depends(get_current_user)
):
    """Get weight history for graphing."""
    measurements = await db.measurements.find(
        {"user_id": user.user_id, "weight_kg": {"$ne": None}},
        {"_id": 0, "date": 1, "weight_kg": 1}
    ).sort("date", -1).to_list(days)
    return {"weights": measurements}

# ==================== PERSONAL RECORDS ROUTES ====================

@exercise_router.get("/prs")
async def get_personal_records(
    limit: int = 10,
    user: User = Depends(get_current_user)
):
    """Get recent personal records."""
    prs = await db.personal_records.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("achieved_at", -1).to_list(limit)
    return {"records": prs}

@exercise_router.get("/prs/{exercise_name}")
async def get_exercise_pr(
    exercise_name: str,
    user: User = Depends(get_current_user)
):
    """Get PR for a specific exercise."""
    pr = await db.personal_records.find_one(
        {"user_id": user.user_id, "exercise_name": {"$regex": f"^{exercise_name}$", "$options": "i"}},
        {"_id": 0}
    )
    
    # Calculate estimated 1RM history
    workouts = await db.workouts.find(
        {
            "user_id": user.user_id,
            "completed_at": {"$ne": None},
            "exercises.exercise_name": {"$regex": f"^{exercise_name}$", "$options": "i"}
        },
        {"_id": 0}
    ).sort("completed_at", -1).to_list(30)
    
    one_rm_history = []
    for workout in workouts:
        for exercise in workout.get("exercises", []):
            if exercise["exercise_name"].lower() == exercise_name.lower():
                max_one_rm = 0
                for set_data in exercise.get("sets", []):
                    if set_data.get("completed") and set_data.get("weight", 0) > 0:
                        # Epley formula: 1RM = weight × (1 + reps/30)
                        weight = set_data["weight"]
                        reps = set_data.get("reps", 1)
                        one_rm = weight * (1 + reps / 30)
                        if one_rm > max_one_rm:
                            max_one_rm = one_rm
                if max_one_rm > 0:
                    one_rm_history.append({
                        "date": workout.get("completed_at"),
                        "one_rm": round(max_one_rm, 1)
                    })
    
    return {
        "current_pr": pr,
        "one_rm_history": one_rm_history
    }

async def check_and_record_pr(user_id: str, exercise_name: str, weight: float, reps: int, workout_id: str):
    """Check if this set is a PR and record it."""
    # Calculate 1RM
    one_rm = weight * (1 + reps / 30)
    
    # Get existing PR
    existing_pr = await db.personal_records.find_one(
        {"user_id": user_id, "exercise_name": {"$regex": f"^{exercise_name}$", "$options": "i"}}
    )
    
    is_pr = False
    if not existing_pr or one_rm > existing_pr.get("one_rm", 0):
        # New PR!
        pr = PersonalRecord(
            user_id=user_id,
            exercise_name=exercise_name,
            weight=weight,
            reps=reps,
            one_rm=round(one_rm, 1),
            workout_id=workout_id
        )
        
        if existing_pr:
            await db.personal_records.update_one(
                {"_id": existing_pr["_id"]},
                {"$set": pr.dict()}
            )
        else:
            await db.personal_records.insert_one(pr.dict())
        
        is_pr = True
    
    return is_pr, round(one_rm, 1)

# ==================== WORKOUT TEMPLATES ROUTES ====================

PRESET_TEMPLATES = [
    {
        "template_id": "preset_push",
        "name": "Push Day",
        "is_preset": True,
        "description": "Hypertrophy-focused push: chest, shoulders, triceps. ~16-18 sets/wk for primary muscles.",
        "exercises": [
            {"exercise_name": "Incline Dumbbell Press", "sets": 4, "reps": "8-12", "rest_seconds": 120, "cue": "Primary chest mass builder — focus on full ROM"},
            {"exercise_name": "Cable Fly", "sets": 3, "reps": "12-15", "rest_seconds": 90, "cue": "Lengthened partial for chest stretch"},
            {"exercise_name": "Dumbbell Bench Press", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Chest volume — control the eccentric"},
            {"exercise_name": "Dumbbell Shoulder Press", "sets": 4, "reps": "10-12", "rest_seconds": 90, "cue": "Primary shoulder press — seated for stability"},
            {"exercise_name": "Cable Lateral Raise", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Medial delt isolation — pause at top"},
            {"exercise_name": "Rear Delt Fly", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Cable rear delt — health and posture"},
            {"exercise_name": "Overhead Tricep Extension", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Long head stretch — feel the deep stretch"},
            {"exercise_name": "Tricep Pushdown", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Tricep volume — squeeze at lockout"},
            {"exercise_name": "Lateral Raise", "sets": 2, "reps": "15", "rest_seconds": 45, "cue": "Mechanical drop set finisher — 2 angles"}
        ]
    },
    {
        "template_id": "preset_pull",
        "name": "Pull Day",
        "is_preset": True,
        "description": "Back, biceps, rear delts. Heavy lat work + bicep variation for full development.",
        "exercises": [
            {"exercise_name": "Pull Up", "sets": 4, "reps": "6-10", "rest_seconds": 120, "cue": "Primary lat builder — weighted if you can"},
            {"exercise_name": "Cable Row", "sets": 4, "reps": "10-12", "rest_seconds": 90, "cue": "Mid back thickness — drive elbows back"},
            {"exercise_name": "Dumbbell Row", "sets": 3, "reps": "10-12 each", "rest_seconds": 90, "cue": "Single arm — full lat stretch at bottom"},
            {"exercise_name": "Face Pull", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Rear delt and rotator cuff health"},
            {"exercise_name": "Incline Curl", "sets": 3, "reps": "10-15", "rest_seconds": 75, "cue": "Bicep long head lengthened partial"},
            {"exercise_name": "Cable Curl", "sets": 3, "reps": "12-15", "rest_seconds": 60, "cue": "Bicep peak — constant tension"},
            {"exercise_name": "Hammer Curl", "sets": 3, "reps": "12-15", "rest_seconds": 60, "cue": "Brachialis and forearm"},
            {"exercise_name": "Straight Arm Pulldown", "sets": 3, "reps": "12-15", "rest_seconds": 60, "cue": "Lat isolation finisher"}
        ]
    },
    {
        "template_id": "preset_legs",
        "name": "Leg Day",
        "is_preset": True,
        "description": "Complete legs: quads, hams, glutes, calves with injury prevention work.",
        "exercises": [
            {"exercise_name": "Squat", "sets": 4, "reps": "6-10", "rest_seconds": 180, "cue": "Primary quad builder — hit depth"},
            {"exercise_name": "Romanian Deadlift", "sets": 4, "reps": "8-12", "rest_seconds": 120, "cue": "Primary hamstring builder — hinge at hips"},
            {"exercise_name": "Bulgarian Split Squat", "sets": 3, "reps": "10-12 each", "rest_seconds": 90, "cue": "Unilateral quad and glute"},
            {"exercise_name": "Leg Curl", "sets": 4, "reps": "10-15", "rest_seconds": 75, "cue": "Hamstring isolation — seated or lying"},
            {"exercise_name": "Leg Extension", "sets": 3, "reps": "12-15", "rest_seconds": 60, "cue": "Quad isolation — pause at top"},
            {"exercise_name": "Hip Thrust", "sets": 3, "reps": "10-15", "rest_seconds": 90, "cue": "Glute isolation — squeeze at top"},
            {"exercise_name": "Nordic Curl", "sets": 3, "reps": "5-8", "rest_seconds": 90, "cue": "Hamstring eccentric — injury prevention"},
            {"exercise_name": "Calf Raise", "sets": 4, "reps": "12-15", "rest_seconds": 60, "cue": "Standing — gastrocnemius focus"},
            {"exercise_name": "Seated Calf Raise", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Soleus focus — bent knee"}
        ]
    },
    {
        "template_id": "preset_upper",
        "name": "Upper Body",
        "is_preset": True,
        "description": "Full upper body session — chest, back, shoulders, arms balanced.",
        "exercises": [
            {"exercise_name": "Bench Press", "sets": 4, "reps": "6-10", "rest_seconds": 120, "cue": "Heavy primary push"},
            {"exercise_name": "Pull Up", "sets": 4, "reps": "6-10", "rest_seconds": 120, "cue": "Heavy primary pull — weighted if you can"},
            {"exercise_name": "Overhead Press", "sets": 3, "reps": "8-12", "rest_seconds": 90, "cue": "Vertical pressing strength"},
            {"exercise_name": "Pendlay Row", "sets": 3, "reps": "8-10", "rest_seconds": 90, "cue": "Reset on floor each rep — explosive"},
            {"exercise_name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Upper chest emphasis"},
            {"exercise_name": "Cable Row", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Mid back — squeeze scaps"},
            {"exercise_name": "Lateral Raise", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Medial delts"},
            {"exercise_name": "Face Pull", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Rear delt health"},
            {"exercise_name": "Incline Curl", "sets": 3, "reps": "10-15", "rest_seconds": 75, "cue": "Bicep long head"},
            {"exercise_name": "Overhead Tricep Extension", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Tricep long head stretch"}
        ]
    },
    {
        "template_id": "preset_lower",
        "name": "Lower Body",
        "is_preset": True,
        "description": "Heavy lower body — squat or deadlift focus with accessories.",
        "exercises": [
            {"exercise_name": "Deadlift", "sets": 4, "reps": "5-8", "rest_seconds": 180, "cue": "Heavy hip hinge — neutral spine"},
            {"exercise_name": "Front Squat", "sets": 3, "reps": "8-12", "rest_seconds": 120, "cue": "Quad emphasis — upright torso"},
            {"exercise_name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Hamstring focus"},
            {"exercise_name": "Leg Curl", "sets": 4, "reps": "10-15", "rest_seconds": 75, "cue": "Hamstring isolation"},
            {"exercise_name": "Bulgarian Split Squat", "sets": 3, "reps": "10-12 each", "rest_seconds": 90, "cue": "Unilateral — front foot work"},
            {"exercise_name": "Leg Extension", "sets": 3, "reps": "12-15", "rest_seconds": 60, "cue": "Quad pump"},
            {"exercise_name": "Hip Thrust", "sets": 4, "reps": "10-15", "rest_seconds": 90, "cue": "Glute power"},
            {"exercise_name": "Calf Raise", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Full ROM — squeeze top"}
        ]
    },
    {
        "template_id": "preset_fullbody",
        "name": "Full Body (Day A)",
        "is_preset": True,
        "description": "Day A of 3-day full body split — squat focus + heavy push/pull. Pair with Day B and rest day rotation.",
        "exercises": [
            {"exercise_name": "Squat", "sets": 4, "reps": "6-8", "rest_seconds": 180, "cue": "Heavy compound — drive through heels"},
            {"exercise_name": "Bench Press", "sets": 4, "reps": "6-8", "rest_seconds": 120, "cue": "Heavy push — touch chest"},
            {"exercise_name": "Pull Up", "sets": 4, "reps": "6-8", "rest_seconds": 120, "cue": "Heavy pull — weighted if you can"},
            {"exercise_name": "Romanian Deadlift", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Hamstring development"},
            {"exercise_name": "Overhead Press", "sets": 3, "reps": "8-10", "rest_seconds": 90, "cue": "Vertical press strength"},
            {"exercise_name": "Face Pull", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Rear delt health"},
            {"exercise_name": "Incline Curl", "sets": 3, "reps": "10-15", "rest_seconds": 75, "cue": "Bicep long head"},
            {"exercise_name": "Lateral Raise", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Medial delts"}
        ]
    },
    {
        "template_id": "preset_fullbody_b",
        "name": "Full Body (Day B)",
        "is_preset": True,
        "description": "Day B of 3-day full body split — deadlift focus + dumbbell push/pull volume.",
        "exercises": [
            {"exercise_name": "Deadlift", "sets": 4, "reps": "5-6", "rest_seconds": 180, "cue": "Heavy hinge — set back position"},
            {"exercise_name": "Incline Dumbbell Press", "sets": 4, "reps": "8-12", "rest_seconds": 90, "cue": "Upper chest emphasis"},
            {"exercise_name": "Cable Row", "sets": 4, "reps": "10-12", "rest_seconds": 90, "cue": "Mid back thickness"},
            {"exercise_name": "Bulgarian Split Squat", "sets": 3, "reps": "10-12 each", "rest_seconds": 90, "cue": "Unilateral leg work"},
            {"exercise_name": "Lateral Raise", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Medial delt volume"},
            {"exercise_name": "Overhead Tricep Extension", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Tricep stretch"},
            {"exercise_name": "Leg Curl", "sets": 3, "reps": "10-15", "rest_seconds": 75, "cue": "Hamstring isolation"},
            {"exercise_name": "Hip Thrust", "sets": 3, "reps": "10-15", "rest_seconds": 90, "cue": "Glute drive"}
        ]
    },
    {
        "template_id": "preset_ppl",
        "name": "PPL Push (use with Pull/Legs)",
        "is_preset": True,
        "description": "Push session in a Push-Pull-Legs split. Rotate Push/Pull/Legs/Push/Pull/Legs/Rest weekly.",
        "exercises": [
            {"exercise_name": "Incline Dumbbell Press", "sets": 4, "reps": "8-12", "rest_seconds": 120, "cue": "Primary chest mass builder"},
            {"exercise_name": "Cable Fly", "sets": 3, "reps": "12-15", "rest_seconds": 90, "cue": "Chest stretch"},
            {"exercise_name": "Dumbbell Bench Press", "sets": 3, "reps": "10-12", "rest_seconds": 90, "cue": "Chest volume"},
            {"exercise_name": "Dumbbell Shoulder Press", "sets": 4, "reps": "10-12", "rest_seconds": 90, "cue": "Shoulder press"},
            {"exercise_name": "Cable Lateral Raise", "sets": 4, "reps": "15-20", "rest_seconds": 60, "cue": "Medial delts"},
            {"exercise_name": "Rear Delt Fly", "sets": 3, "reps": "15-20", "rest_seconds": 60, "cue": "Rear delt health"},
            {"exercise_name": "Overhead Tricep Extension", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Tricep long head"},
            {"exercise_name": "Tricep Pushdown", "sets": 3, "reps": "12-15", "rest_seconds": 75, "cue": "Tricep volume"}
        ]
    }
]

@templates_router.get("")
async def get_templates(user: User = Depends(get_current_user)):
    """Get all workout templates (preset + user created + copied)."""
    user_templates = await db.workout_templates.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(50)

    # Split user templates into custom (created from scratch) and copied (from preset/coach)
    custom = [t for t in user_templates if not t.get("is_copied")]
    copied = [t for t in user_templates if t.get("is_copied")]

    return {
        "presets": PRESET_TEMPLATES,
        "user_templates": user_templates,  # legacy combined field — keep for back-compat
        "custom_templates": custom,
        "copied_templates": copied,
        "limits": {
            "max_custom": 3,
            "max_copied": 3,
            "custom_used": len(custom),
            "copied_used": len(copied),
        },
    }

@templates_router.post("")
async def save_template(
    template_data: dict,
    user: User = Depends(get_current_user)
):
    """Save a workout as a template.

    Enforces limits:
      - max 3 custom templates (created from scratch)
      - max 3 copied templates (cloned from a preset or coach template, denoted
        by `is_copied: true` or a `source_template_id` field)
    """
    is_copied = bool(template_data.get("is_copied") or template_data.get("source_template_id"))

    # Count existing
    existing = await db.workout_templates.find({"user_id": user.user_id}).to_list(50)
    custom_used = sum(1 for t in existing if not t.get("is_copied"))
    copied_used = sum(1 for t in existing if t.get("is_copied"))

    if is_copied and copied_used >= 3:
        raise HTTPException(
            status_code=400,
            detail="You have reached the maximum of 3 copied templates. Delete one to save a new one.",
        )
    if (not is_copied) and custom_used >= 3:
        raise HTTPException(
            status_code=400,
            detail="You have reached the maximum of 3 custom templates. Delete one to save a new one.",
        )

    template = WorkoutTemplate(
        user_id=user.user_id,
        name=template_data.get("name", "My Template"),
        exercises=template_data.get("exercises", []),
        is_preset=False,
    )
    payload = template.dict()
    payload["is_copied"] = is_copied
    if template_data.get("source_template_id"):
        payload["source_template_id"] = template_data["source_template_id"]

    await db.workout_templates.insert_one(payload)
    return payload

@templates_router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a user template."""
    result = await db.workout_templates.delete_one(
        {"template_id": template_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return {"message": "Template deleted"}


@templates_router.put("/{template_id}")
async def update_template(
    template_id: str,
    template_data: dict,
    user: User = Depends(get_current_user),
):
    """Update an existing user template (rename + exercises + notes etc)."""
    patch = {}
    if "name" in template_data:
        patch["name"] = template_data["name"]
    if "exercises" in template_data:
        patch["exercises"] = template_data["exercises"]
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.workout_templates.update_one(
        {"template_id": template_id, "user_id": user.user_id},
        {"$set": patch},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    updated = await db.workout_templates.find_one(
        {"template_id": template_id, "user_id": user.user_id},
        {"_id": 0},
    )
    return updated


@templates_router.post("/{template_id}/duplicate")
async def duplicate_template(
    template_id: str,
    user: User = Depends(get_current_user),
):
    """Duplicate an existing user template (counts against the same custom/copied
    quota as the original)."""
    src = await db.workout_templates.find_one(
        {"template_id": template_id, "user_id": user.user_id},
        {"_id": 0},
    )
    if not src:
        raise HTTPException(status_code=404, detail="Template not found")
    # Enforce same quota as save_template
    existing = await db.workout_templates.find({"user_id": user.user_id}).to_list(50)
    custom_used = sum(1 for t in existing if not t.get("is_copied"))
    copied_used = sum(1 for t in existing if t.get("is_copied"))
    is_copied = bool(src.get("is_copied"))
    if is_copied and copied_used >= 3:
        raise HTTPException(status_code=400, detail="Copied template limit (3) reached")
    if (not is_copied) and custom_used >= 3:
        raise HTTPException(status_code=400, detail="Custom template limit (3) reached")

    dup = {
        **src,
        "template_id": f"tmpl_{uuid.uuid4().hex[:12]}",
        "name": f"{src.get('name', 'My Template')} Copy",
        "created_at": datetime.now(timezone.utc),
    }
    await db.workout_templates.insert_one(dup)
    return dup

# ==================== PLATE CALCULATOR ====================

PLATE_WEIGHTS_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
PLATE_WEIGHTS_LBS = [45, 35, 25, 10, 5, 2.5]
BARBELL_WEIGHT_KG = 20
BARBELL_WEIGHT_LBS = 45

PLATE_COLORS = {
    25: "#FF0000",   # Red
    20: "#0066FF",   # Blue
    15: "#FFFF00",   # Yellow
    10: "#00FF00",   # Green
    5: "#FFFFFF",    # White
    2.5: "#000000",  # Black
    1.25: "#888888", # Grey
    45: "#0066FF",   # Blue (lbs)
    35: "#FFFF00",   # Yellow (lbs)
}

@exercise_router.get("/plate-calculator")
async def calculate_plates(
    weight: float,
    unit: str = "kg"
):
    """Calculate which plates to load on each side of the barbell."""
    barbell = BARBELL_WEIGHT_KG if unit == "kg" else BARBELL_WEIGHT_LBS
    plates = PLATE_WEIGHTS_KG if unit == "kg" else PLATE_WEIGHTS_LBS
    
    if weight < barbell:
        return {"error": f"Weight must be at least {barbell}{unit} (barbell weight)"}
    
    weight_per_side = (weight - barbell) / 2
    plates_per_side = []
    
    remaining = weight_per_side
    for plate in plates:
        while remaining >= plate:
            plates_per_side.append({
                "weight": plate,
                "color": PLATE_COLORS.get(plate, "#888888")
            })
            remaining -= plate
    
    return {
        "total_weight": weight,
        "barbell_weight": barbell,
        "per_side": weight_per_side,
        "plates_per_side": plates_per_side,
        "unit": unit
    }

# ==================== INDIAN FOODS DB + GEMINI SCANNER ====================

# Load full ICMR-NIN INDB 2024 database (1014 foods, lab-analyzed per-100g nutrients)
_INDB_PATH = Path(__file__).parent / "data" / "indb_foods.json"
try:
    with open(_INDB_PATH, "r", encoding="utf-8") as _f:
        _INDB = _json.load(_f)
    INDB_FOODS: List[dict] = _INDB.get("foods", [])
    INDB_VERSION = _INDB.get("version", "INDB 2024")
    INDB_SOURCE = _INDB.get("source", "ICMR-NIN INDB 2024")
    logger.info(f"Loaded {len(INDB_FOODS)} Indian foods from INDB 2024")
except Exception as _e:
    INDB_FOODS = []
    INDB_VERSION = "missing"
    INDB_SOURCE = "missing"
    logger.warning(f"Could not load INDB: {_e}")

# Load GroceryDB (Ravandi 2023) — 33k US packaged foods with processing scores
_GROCERYDB_PATH = Path(__file__).parent / "data" / "grocerydb_foods.json"
try:
    with open(_GROCERYDB_PATH, "r", encoding="utf-8") as _f:
        _GDB = _json.load(_f)
    GROCERYDB_FOODS: List[dict] = _GDB.get("foods", [])
    GROCERYDB_SOURCE = _GDB.get("source", "GroceryDB (Ravandi et al, Nature Food 2023)")
    logger.info(f"Loaded {len(GROCERYDB_FOODS)} packaged foods from GroceryDB")
except Exception as _e:
    GROCERYDB_FOODS = []
    GROCERYDB_SOURCE = "missing"
    logger.warning(f"Could not load GroceryDB: {_e}")


# Load Asian foods composition (FAO/INFOODS regional databases)
_ASIAN_PATH = Path(__file__).parent / "data" / "asian_foods.json"
try:
    with open(_ASIAN_PATH, "r", encoding="utf-8") as _f:
        _ASIAN = _json.load(_f)
    ASIAN_FOODS: List[dict] = _ASIAN.get("foods", [])
    ASIAN_VERSION = _ASIAN.get("version", "Asian Foods v1")
    ASIAN_SOURCE = _ASIAN.get("source", "FAO/INFOODS Regional Food Composition Tables")
    logger.info(f"Loaded {len(ASIAN_FOODS)} Asian foods from FAO/INFOODS regional tables")
except Exception as _e:
    ASIAN_FOODS = []
    ASIAN_VERSION = "missing"
    ASIAN_SOURCE = "missing"
    logger.warning(f"Could not load Asian foods: {_e}")


# Load restaurant foods (official US chain nutrition disclosures)
_RESTAURANT_PATH = Path(__file__).parent / "data" / "restaurant_foods.json"
try:
    with open(_RESTAURANT_PATH, "r", encoding="utf-8") as _f:
        _REST = _json.load(_f)
    RESTAURANT_DATA: List[dict] = _REST.get("restaurants", [])
    # Build flat search index — list of {restaurant, item, aliases, ...}
    RESTAURANT_ITEMS_FLAT: List[dict] = []
    for r in RESTAURANT_DATA:
        rname = r.get("restaurant", "")
        rurl = r.get("source_url", "")
        for it in r.get("items", []):
            flat = dict(it)
            flat["restaurant"] = rname
            flat["source_url"] = rurl
            flat["restaurant_lower"] = rname.lower()
            RESTAURANT_ITEMS_FLAT.append(flat)
    RESTAURANT_VERSION = _REST.get("version", "Restaurant Foods v1")
    logger.info(f"Loaded {len(RESTAURANT_ITEMS_FLAT)} restaurant items across {len(RESTAURANT_DATA)} chains")
except Exception as _e:
    RESTAURANT_DATA = []
    RESTAURANT_ITEMS_FLAT = []
    RESTAURANT_VERSION = "missing"
    logger.warning(f"Could not load restaurant foods: {_e}")


def asian_food_lookup(name: str, cuisine_hint: Optional[str] = None) -> Optional[dict]:
    """Fuzzy match a dish name against the Asian foods database.
    Cuisine hint (Japanese, Korean, Chinese, Thai, Vietnamese, Pakistani, Sri Lankan, Bangladeshi)
    narrows the search. Returns None if no good match.
    """
    import re as _re
    if not name or not ASIAN_FOODS:
        return None
    q = name.lower().strip()
    q_tokens = set(_re.findall(r"[a-z]{3,}", q))
    if not q_tokens:
        return None
    cuisine = (cuisine_hint or "").lower().strip() if cuisine_hint else None

    best = None
    best_score = 0
    for f in ASIAN_FOODS:
        # Optional cuisine filter — when hint given prefer matches but don't exclude
        f_cuisine = (f.get("cuisine") or "").lower()
        cuisine_bonus = 2 if (cuisine and cuisine in f_cuisine) else 0

        # Check name + aliases
        candidates = [(f.get("name") or "").lower()]
        candidates += [(a or "").lower() for a in (f.get("aliases") or [])]
        for c in candidates:
            if not c:
                continue
            # Exact match shortcut
            if c == q:
                return f
            c_tokens = set(_re.findall(r"[a-z]{3,}", c))
            overlap = len(q_tokens & c_tokens)
            if overlap == 0:
                continue
            # Score: token overlap + cuisine match
            score = overlap * 2 + cuisine_bonus
            # Bonus if alias is fully contained in query (e.g. "pad thai")
            if c in q or q in c:
                score += 3
            if score > best_score:
                best_score = score
                best = f
    # Require at least overlap of 1 meaningful token
    return best if best_score >= 2 else None


def restaurant_food_lookup(restaurant: Optional[str], item: Optional[str]) -> Optional[dict]:
    """Fuzzy lookup a restaurant chain menu item.
    `restaurant` is the chain (e.g. "Starbucks", "McDonald's", "Mcdonalds").
    `item` is the item name/variant (e.g. "Grande Caramel Macchiato", "Big Mac").
    """
    import re as _re
    if not item or not RESTAURANT_ITEMS_FLAT:
        return None
    rq = (restaurant or "").lower().strip()
    iq = item.lower().strip()
    iq_tokens = set(_re.findall(r"[a-z]{3,}", iq))
    if not iq_tokens:
        return None

    # Normalize common restaurant naming variants
    rq_norm = (
        rq.replace("mcdonald's", "mcdonalds")
          .replace("mcdonald", "mcdonalds")
          .replace("chick-fil-a", "chick-fil-a")
          .replace("chick fil a", "chick-fil-a")
          .replace("chickfila", "chick-fil-a")
          .replace("domino's", "domino's")
          .replace("dominos", "domino's")
    )

    best = None
    best_score = 0
    for entry in RESTAURANT_ITEMS_FLAT:
        ent_rest = entry["restaurant_lower"]
        # Restaurant gate: if we got a hint and it doesn't match this restaurant, skip
        restaurant_match = False
        if rq:
            rn = ent_rest.replace("'", "")
            rqn = rq_norm.replace("'", "").replace("-", " ")
            if rn in rqn or rqn in rn or ent_rest in rq_norm or rq_norm in ent_rest:
                restaurant_match = True
            if not restaurant_match:
                # Allow loose match if iq strongly identifies item
                continue

        # Build candidate strings
        candidates = [entry["name"].lower()]
        candidates += [(a or "").lower() for a in (entry.get("aliases") or [])]
        for c in candidates:
            if not c:
                continue
            c_tokens = set(_re.findall(r"[a-z]{3,}", c))
            overlap = len(iq_tokens & c_tokens)
            if overlap == 0:
                continue
            score = overlap * 2
            if c in iq or iq in c:
                score += 4
            # Bonus if restaurant matched explicitly
            if restaurant_match:
                score += 3
            if score > best_score:
                best_score = score
                best = entry
    return best if best_score >= 3 else None


def grocerydb_lookup(brand: Optional[str], product: Optional[str]) -> Optional[dict]:
    """Fuzzy text-match a packaged product in GroceryDB.

    Strategy: require at least one meaningful product-name token to appear
    in the GroceryDB product name (word-boundary). When a brand is supplied,
    rank brand-matching candidates first. Returns the first kcal-positive
    match in the same shape as `lookup_packaged_product`.
    """
    import re as _re
    if not GROCERYDB_FOODS or not product:
        return None
    br = (brand or "").strip().lower()
    pname = product.strip().lower()

    # Meaningful tokens (≥4 chars, skip generic words)
    tokens = set(_re.findall(r"[a-z]{4,}", pname))
    tokens -= {"food", "product", "variety", "flavor", "flavour"}
    if not tokens:
        return None
    min_overlap = max(1, (len(tokens) + 1) // 2)

    candidates = []
    for f in GROCERYDB_FOODS:
        name_lower = f["name"].lower()
        # Check first 80 chars only (product name, not ingredients)
        head = name_lower[:80]
        hits = sum(1 for t in tokens if _re.search(rf"\b{_re.escape(t)}\b", head))
        if hits < min_overlap:
            continue
        brand_lower = (f.get("brand") or "").lower()
        brand_match = br and (br in brand_lower or brand_lower in br)
        candidates.append((0 if brand_match else 1, -hits, f))

    if not candidates:
        return None
    candidates.sort(key=lambda x: (x[0], x[1]))
    f = candidates[0][2]
    p100 = f.get("per_100g", {})
    if not p100.get("calories") or p100["calories"] <= 0:
        return None
    return {
        "name": f["name"],
        "brand": f.get("brand") or brand,
        "calories_per_100g": float(p100.get("calories", 0)),
        "protein_per_100g": float(p100.get("protein", 0)),
        "carbs_per_100g": float(p100.get("carbs", 0)),
        "fats_per_100g": float(p100.get("fats", 0)),
        "fiber_per_100g": float(p100.get("fiber", 0)),
        "serving_size_g": 100,
        "nova_class": f.get("nova_class"),
        "fpro": f.get("fpro"),
        "category": f.get("category"),
        "source": "grocerydb",
        "source_label": "Source: GroceryDB (Nature Food 2023)",
    }
_INDB_INDEX: Dict[str, dict] = {}
for _food in INDB_FOODS:
    for _alias in _food.get("aliases", []):
        # Keep the first (usually most specific) match for each alias
        if _alias not in _INDB_INDEX:
            _INDB_INDEX[_alias] = _food


def indb_lookup(name: str) -> Optional[dict]:
    """Fuzzy-find an INDB food by name with synonym/alias support.

    Strategy:
      1. Exact lowercase match against the cleaned food name
      2. Exact alias match (only if query is >=4 chars — avoids 3-letter generic matches)
      3. Word-boundary match: query is a whole word inside the food name
      4. Substring match with strict length overlap threshold (≥40%)
      5. Token-based match (≥2 tokens of 4+ chars in common)
    """
    if not name or not INDB_FOODS:
        return None
    q = name.lower().strip()
    if len(q) < 3:
        return None
    # 1. Exact food name match
    for f in INDB_FOODS:
        if f["name"].lower() == q:
            return f
    # 2. Word-boundary match inside food name — prefer shortest name (most generic)
    pat = re.compile(rf"\b{re.escape(q)}\b", re.IGNORECASE)
    best = None
    best_namelen = 10 ** 9
    for f in INDB_FOODS:
        if pat.search(f["name"]):
            if len(f["name"]) < best_namelen:
                best = f
                best_namelen = len(f["name"])
    if best:
        return best
    # 3. Exact alias match (only for 4+ char queries to avoid generic false positives)
    if len(q) >= 4 and q in _INDB_INDEX:
        return _INDB_INDEX[q]
    # 4. Substring overlap (stricter: require ≥4 char query and ≥40% overlap)
    if len(q) >= 4:
        best = None
        best_score = 0
        for alias, food in _INDB_INDEX.items():
            if len(alias) < 4:
                continue
            if q in alias or alias in q:
                overlap = min(len(q), len(alias))
                longer = max(len(q), len(alias))
                if longer > 0 and overlap / longer < 0.4:
                    continue
                if overlap > best_score:
                    best_score = overlap
                    best = food
        if best:
            return best
    # 5. Token overlap (≥2 four-letter tokens shared)
    q_tokens = set(re.findall(r"[a-z]{4,}", q))
    if len(q_tokens) >= 2:
        best = None
        best_score = 0
        for f in INDB_FOODS:
            f_tokens = set(re.findall(r"[a-z]{4,}", f["name"].lower()))
            overlap = len(q_tokens & f_tokens)
            if overlap >= 2 and overlap > best_score:
                best_score = overlap
                best = f
        return best
    return None


def format_indb_result(food: dict, portion_g: Optional[float] = None) -> dict:
    """Convert an INDB food into the same shape used elsewhere in the app.

    INDB stores serving.size_g as the TOTAL recipe weight and
    servings_per_recipe as how many portions that recipe yields.
    The realistic per-serving weight = size_g / servings_per_recipe.
    """
    per100 = food.get("per_100g", {})
    serving = food.get("serving", {}) or {}
    total_recipe_g = serving.get("size_g") or 0
    servings_per_recipe = serving.get("servings_per_recipe") or 1
    try:
        per_serving_g = total_recipe_g / servings_per_recipe if servings_per_recipe else total_recipe_g
    except ZeroDivisionError:
        per_serving_g = total_recipe_g
    # Sanity check: keep serving in realistic 20-500g range. Fall back to 100g if weird.
    if not per_serving_g or per_serving_g <= 0 or per_serving_g > 800:
        per_serving_g = 100.0
    # If no portion specified, use the default per-serving size
    use_g = portion_g if portion_g else per_serving_g
    factor = use_g / 100.0
    return {
        "name": food["name"],
        "orig_name": food.get("orig_name"),
        "food_code": food["food_code"],
        "calories": round(per100.get("calories", 0) * factor, 1),
        "protein": round(per100.get("protein_g", 0) * factor, 1),
        "carbs": round(per100.get("carb_g", 0) * factor, 1),
        "fats": round(per100.get("fat_g", 0) * factor, 1),
        "fiber": round(per100.get("fiber_g", 0) * factor, 1),
        "sugar": round(per100.get("sugar_g", 0) * factor, 1) if per100.get("sugar_g") else None,
        "calcium_mg": round(per100.get("calcium_mg", 0) * factor, 1) if per100.get("calcium_mg") else None,
        "iron_mg": round(per100.get("iron_mg", 0) * factor, 2) if per100.get("iron_mg") else None,
        "zinc_mg": round(per100.get("zinc_mg", 0) * factor, 2) if per100.get("zinc_mg") else None,
        "sodium_mg": round(per100.get("sodium_mg", 0) * factor, 1) if per100.get("sodium_mg") else None,
        "portion_g": round(use_g, 0),
        "default_serving_g": round(per_serving_g, 0),
        "per_100g": {
            "calories": per100.get("calories", 0),
            "protein": per100.get("protein_g", 0),
            "carbs": per100.get("carb_g", 0),
            "fats": per100.get("fat_g", 0),
            "fiber": per100.get("fiber_g", 0),
        },
        "unit": serving.get("unit"),
        "servings_per_recipe": servings_per_recipe,
        "source": "INDB_2024",
        "source_label": "Source: ICMR-NIN INDB 2024",
    }


# Cooking method calorie additions
COOKING_METHODS = {
    "dry": {"label": "Dry / Steamed", "extra_kcal": 0, "extra_fat_g": 0},
    "light_oil": {"label": "Light Oil", "extra_kcal": 40, "extra_fat_g": 4.5},
    "moderate_oil": {"label": "Moderate Oil", "extra_kcal": 80, "extra_fat_g": 9},
    "heavy_oil": {"label": "Heavy Oil / Ghee", "extra_kcal": 150, "extra_fat_g": 17},
}

@scanner_router.get("/indian-foods")
async def get_indian_foods(q: str = "", limit: int = 50):
    """Return INDB foods matching the query. If q is empty returns first 50
    alphabetically. Full list available via /indian-foods/all."""
    if not INDB_FOODS:
        return {"foods": [], "source": "unavailable", "total": 0}
    items = INDB_FOODS
    if q:
        ql = q.lower().strip()
        hits = []
        for f in items:
            if ql in f["name"].lower() or any(ql in a for a in f.get("aliases", [])):
                hits.append(f)
        items = hits
    # Return ready-to-display shape
    return {
        "foods": [format_indb_result(f) for f in items[:limit]],
        "total": len(items),
        "source": INDB_SOURCE,
        "version": INDB_VERSION,
    }


@scanner_router.get("/indian-foods/all")
async def get_all_indian_foods(offset: int = 0, limit: int = 200):
    """Paginated access to the full INDB database (1014 entries).
    Used by the Indian Food Database browse screen."""
    if not INDB_FOODS:
        return {"foods": [], "total": 0}
    slice_ = INDB_FOODS[offset: offset + limit]
    return {
        "foods": [format_indb_result(f) for f in slice_],
        "total": len(INDB_FOODS),
        "offset": offset,
        "limit": limit,
        "source": INDB_SOURCE,
        "version": INDB_VERSION,
    }


@scanner_router.get("/indian-foods/lookup")
async def lookup_indian_food(name: str, portion_g: Optional[float] = None):
    """Fuzzy-lookup a single INDB food by name/alias. Used by Gemini scanner
    to enrich AI-detected foods with lab-analyzed nutrient values."""
    food = indb_lookup(name)
    if not food:
        return {"match": None, "source": "not_found"}
    return {"match": format_indb_result(food, portion_g)}


@scanner_router.get("/cooking-methods")
async def get_cooking_methods():
    return {"methods": COOKING_METHODS}


@scanner_router.get("/asian-foods")
async def list_asian_foods(country: Optional[str] = None, q: Optional[str] = None, limit: int = 50):
    """List/search Asian food composition records (FAO/INFOODS regional)."""
    items = ASIAN_FOODS
    if country:
        items = [f for f in items if (f.get("country") or "").lower() == country.lower()]
    if q:
        ql = q.lower()
        items = [f for f in items if ql in (f.get("name") or "").lower() or
                 any(ql in (a or "").lower() for a in (f.get("aliases") or []))]
    return {
        "version": ASIAN_VERSION,
        "source": ASIAN_SOURCE,
        "total": len(items),
        "foods": items[:limit],
    }


@scanner_router.get("/asian-foods/lookup")
async def asian_food_lookup_endpoint(name: str, cuisine: Optional[str] = None):
    """Fuzzy-match an Asian food name. Returns match or null."""
    hit = asian_food_lookup(name, cuisine)
    if not hit:
        return {"match": None}
    return {
        "match": hit,
        "source_label": f"Source: FAO/INFOODS {hit.get('country')} ({hit.get('source_db', 'national FCT')})",
    }


@scanner_router.get("/restaurants")
async def list_restaurants():
    """List all restaurant chains with item counts."""
    return {
        "restaurants": [
            {"name": r.get("restaurant"), "source_url": r.get("source_url"), "item_count": len(r.get("items", []))}
            for r in RESTAURANT_DATA
        ],
        "total_items": len(RESTAURANT_ITEMS_FLAT),
    }


@scanner_router.get("/restaurants/{restaurant_name}/items")
async def list_restaurant_items(restaurant_name: str):
    """List items for a specific restaurant chain."""
    target = restaurant_name.lower().replace("'", "").replace("-", " ")
    for r in RESTAURANT_DATA:
        rn = (r.get("restaurant") or "").lower().replace("'", "").replace("-", " ")
        if rn == target or rn in target or target in rn:
            return {
                "restaurant": r.get("restaurant"),
                "source_url": r.get("source_url"),
                "items": r.get("items", []),
            }
    raise HTTPException(status_code=404, detail=f"Restaurant '{restaurant_name}' not found")


@scanner_router.get("/restaurants/lookup")
async def restaurant_lookup_endpoint(restaurant: Optional[str] = None, item: str = ""):
    """Fuzzy-match a restaurant menu item. Returns match or null."""
    hit = restaurant_food_lookup(restaurant, item)
    if not hit:
        return {"match": None}
    return {
        "match": hit,
        "source_label": f"Source: Official {hit.get('restaurant')} Nutrition Data",
    }


class GeminiScanRequest(BaseModel):
    image_base64: str

# Direct Gemini API helper using user's specific key
async def _gemini_vision(image_base64: str, prompt: str, system_instruction: str = "") -> str:
    """Call Gemini 2.5 Flash via direct REST with the user's GEMINI_API_KEY."""
    import httpx
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    # Gemini 2.5 Flash multimodal endpoint
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={api_key}"
    )
    contents = [{
        "role": "user",
        "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": "image/jpeg", "data": image_base64}},
        ],
    }]
    body = {
        "contents": contents,
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            r = await client.post(url, json=body)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Gemini network error: {e}")
        if r.status_code != 200:
            logger.error(f"Gemini error {r.status_code}: {r.text[:500]}")
            raise HTTPException(status_code=502, detail=f"Gemini API error: {r.status_code}")
        data = r.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            logger.error(f"Gemini unexpected: {data}")
            raise HTTPException(status_code=502, detail="Gemini returned no content")


async def lookup_packaged_product(brand: Optional[str], product: Optional[str]) -> Optional[dict]:
    """Search USDA → Open Food Facts for a packaged product by brand + name.

    Returns a normalized nutrition dict with `source` and `source_label`, or None.
    Used by the photo scanner when Gemini identifies a packaged product.
    """
    import httpx
    name = (product or "").strip()
    br = (brand or "").strip()
    if not name:
        return None
    query = f"{br} {name}".strip()
    usda_key = os.getenv("USDA_API_KEY")

    # --- Step 1: USDA FoodData Central text search (branded foods) ---
    # Require at least one meaningful product-name token (≥4 chars) to appear in
    # the result description. Prevents "Sparkling Water" from returning
    # unrelated items like "Strawberry Spread" from the same brand.
    prod_tokens = set(re.findall(r"[a-z]{4,}", (name or "").lower()))
    # Truly generic noise words that carry no product info
    prod_tokens -= {"food", "product", "variety", "flavor", "flavour"}
    # Minimum tokens that must appear — majority for multi-word products
    min_overlap = max(1, (len(prod_tokens) + 1) // 2)

    def _matches_product(description: str) -> bool:
        if not prod_tokens:
            return True  # no meaningful tokens — accept brand match alone
        # Look only in the first 60 chars of description (product name, not ingredients)
        d = (description or "").lower()[:60]
        hits = sum(1 for t in prod_tokens if re.search(rf"\b{re.escape(t)}\b", d))
        return hits >= min_overlap

    if usda_key:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.get(
                    "https://api.nal.usda.gov/fdc/v1/foods/search",
                    params={
                        "query": query,
                        "dataType": "Branded",
                        "api_key": usda_key,
                        "pageSize": 10,
                    },
                )
                if r.status_code == 200:
                    data = r.json()
                    foods = data.get("foods", [])
                    # Filter: result description must share a product-name token
                    foods = [f for f in foods if _matches_product(f.get("description"))]
                    # Rank: brand-owner match first
                    if br:
                        foods = sorted(
                            foods,
                            key=lambda f: (
                                0 if br.lower() in (f.get("brandOwner", "") or "").lower()
                                  or br.lower() in (f.get("brandName", "") or "").lower()
                                else 1
                            ),
                        )
                    for f in foods:
                        nutrients = {
                            (n.get("nutrientName") or ""): n.get("value")
                            for n in f.get("foodNutrients", [])
                        }
                        cal = nutrients.get("Energy") or nutrients.get("Energy (Atwater General Factors)")
                        prot = nutrients.get("Protein")
                        if cal and cal > 0:
                            return {
                                "name": f.get("description") or name,
                                "brand": f.get("brandOwner") or f.get("brandName") or br,
                                "calories_per_100g": float(cal),
                                "protein_per_100g": float(prot or 0),
                                "carbs_per_100g": float(nutrients.get("Carbohydrate, by difference") or 0),
                                "fats_per_100g": float(nutrients.get("Total lipid (fat)") or 0),
                                "fiber_per_100g": float(nutrients.get("Fiber, total dietary") or 0),
                                "serving_size_g": f.get("servingSize") or 100,
                                "source": "usda",
                                "source_label": "Source: USDA FoodData Central",
                            }
        except Exception as e:
            logger.warning(f"USDA text search failed: {e}")

    # --- Step 2: Open Food Facts text search ---
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            off = await client.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params={
                    "search_terms": query,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": 3,
                },
            )
            if off.status_code == 200:
                od = off.json()
                products = od.get("products", []) or []
                # Prefer products whose brand matches
                if br:
                    products = sorted(
                        products,
                        key=lambda p: (
                            0 if br.lower() in (p.get("brands", "") or "").lower()
                            else 1
                        ),
                    )
                for p in products:
                    n = p.get("nutriments", {}) or {}
                    cal = n.get("energy-kcal_100g") or n.get("energy-kcal")
                    if cal and float(cal) > 0:
                        return {
                            "name": p.get("product_name") or name,
                            "brand": p.get("brands") or br,
                            "calories_per_100g": float(cal),
                            "protein_per_100g": float(n.get("proteins_100g") or 0),
                            "carbs_per_100g": float(n.get("carbohydrates_100g") or 0),
                            "fats_per_100g": float(n.get("fat_100g") or 0),
                            "fiber_per_100g": float(n.get("fiber_100g") or 0),
                            "serving_size_g": 100,
                            "source": "openfoodfacts",
                            "source_label": "Source: Open Food Facts",
                        }
    except Exception as e:
        logger.warning(f"OFF text search failed: {e}")

    # --- Step 4: GroceryDB local lookup (Ravandi 2023) ---
    gdb = grocerydb_lookup(br, name)
    if gdb:
        return gdb

    return None


@scanner_router.post("/gemini-food")
async def gemini_food_scan(
    request: GeminiScanRequest,
    user: User = Depends(get_current_user)
):
    """Scan a meal photo using Gemini 2.5 Flash with direct API key."""
    import json

    prompt = """You are a precise nutrition analyst with expertise across global cuisines (Indian ICMR-NIN INDB 2024, Japanese MEXT, Korean NIAS, Chinese CDC, Thai INMU, Vietnamese NIN, Pakistani NIH-NIN, Sri Lankan MRI, Bangladeshi INFS reference data) and US restaurant chains. Identify every food item in this image. For each item estimate the weight in grams using any reference objects visible such as hands, plates, utensils, or standard portion sizes. Return ONLY a JSON object with this exact structure: {"confidence": number between 0 and 1, "items": [{"name": string, "weight_g": number, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "is_packaged": boolean, "brand_name": string or null, "product_name": string or null, "is_restaurant": boolean, "restaurant_name": string or null, "restaurant_item": string or null, "size_variant": string or null, "cuisine_type": string or null, "dish_name_local": string or null}], "total": {"calories": number, "protein_g": number, "carbs_g": number, "fat_g": number}, "uncertain_items": [string]}

Important guidelines:
- If you identify a **restaurant chain item** (Starbucks, McDonald's, Chipotle, Chick-fil-A, Subway, Domino's, Taco Bell, Burger King, Panera Bread — recognizable by cup/bag/wrapper logo, in-store decor, or distinctive menu item like Big Mac, Whopper, Crunchwrap), set "is_restaurant": true and fill in: "restaurant_name" (exact chain name), "restaurant_item" (specific item name e.g. "Caramel Macchiato", "Big Mac", "Chicken Burrito Bowl"), and "size_variant" (e.g. "Grande", "Medium", "6-inch", "Large") when visible. Example: {"restaurant_name": "Starbucks", "restaurant_item": "Caramel Macchiato", "size_variant": "Grande"}.
- If you identify a **packaged product** with a visible brand name (bottle, box, bag, can, jar, wrapper with a logo), set "is_packaged": true and fill in "brand_name" (e.g. "Kirkland Signature", "Coca-Cola", "Nature Valley") and "product_name" (e.g. "Sparkling Water Lime", "Protein Granola Bar"). The app will look up exact nutrition in product databases. Still give your best weight/calorie estimate for fallback.
- If you identify **Asian cuisine** specify: "cuisine_type" (one of: Chinese, Japanese, Korean, Thai, Vietnamese, Pakistani, Sri Lankan, Bangladeshi, Indian), "name" (in English — e.g. "Pad Thai", "Bibimbap", "Pho Bo", "Mapo Tofu", "Bulgogi"), and "dish_name_local" (the local-language name if visible on menu, otherwise null).
- For Indian foods, use the most common recognizable English name with the Hindi name in parentheses when helpful (e.g., "Dal Tadka", "Paneer Butter Masala", "Aloo Paratha", "Chapati (Roti)", "Idli", "Sambar") and set "cuisine_type": "Indian". This improves database matching.
- For unpackaged home-cooked foods (not restaurant, not packaged): leave "is_packaged" and "is_restaurant" both false, and set brand_name/product_name/restaurant_name to null.
- Use realistic serving sizes: 1 roti ≈ 30-40g, 1 katori dal ≈ 150g, 1 plate rice ≈ 150g cooked, 1 idli ≈ 40g, 1 dosa ≈ 80g, 1 samosa ≈ 60g, 1 cup tea ≈ 150ml, 1 sushi piece ≈ 25g, 1 sushi roll ≈ 120g, 1 ramen bowl ≈ 500g, 1 pho bowl ≈ 500g, 1 burrito bowl ≈ 500g.
- Numbers must be plain JSON numbers, not strings.
- "uncertain_items" lists item names whose weight estimate has low confidence.
- "total" must equal the sum of items. The app will OVERRIDE your nutrition estimates with official database values when matches are found, so just provide your best estimate.
"""
    try:
        text = await _gemini_vision(request.image_base64, prompt)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()

        try:
            data = json.loads(text)

            # Override with INDB lab-analyzed values (Indian foods) and USDA/OFF
            # values (packaged products) when we find matches.
            override_items = []
            matched_any_indb = False
            matched_any_packaged = False
            matched_any_restaurant = False
            matched_any_asian = False
            any_packaged_unmatched = False  # Gemini flagged packaged but we found no DB match
            for it in data.get("items", []):
                name = (it.get("name") or "").strip()
                weight = float(it.get("weight_g") or 0)
                is_packaged = bool(it.get("is_packaged"))
                is_restaurant = bool(it.get("is_restaurant"))
                brand_name = it.get("brand_name")
                product_name = it.get("product_name")
                restaurant_name = it.get("restaurant_name")
                restaurant_item = it.get("restaurant_item")
                size_variant = it.get("size_variant")
                cuisine_type = it.get("cuisine_type")
                dish_name_local = it.get("dish_name_local")

                # --- 1. Restaurant chain lookup (highest priority if identified) ---
                if is_restaurant and (restaurant_name or restaurant_item):
                    # Build a richer query: include size variant when present
                    query_item = restaurant_item or name
                    if size_variant:
                        query_item = f"{size_variant} {query_item}"
                    rhit = restaurant_food_lookup(restaurant_name, query_item)
                    if rhit:
                        override_items.append({
                            "name": rhit.get("name"),
                            "restaurant": rhit.get("restaurant"),
                            "size": rhit.get("size"),
                            "weight_g": float(rhit.get("serving_g") or weight or 0),
                            "calories": rhit.get("calories"),
                            "protein_g": rhit.get("protein_g"),
                            "carbs_g": rhit.get("carb_g"),
                            "fat_g": rhit.get("fat_g"),
                            "sugar_g": rhit.get("sugar_g"),
                            "sodium_mg": rhit.get("sodium_mg"),
                            "is_restaurant": True,
                            "db_matched": True,
                            "source": "RESTAURANT_OFFICIAL",
                            "source_label": f"Source: Official {rhit.get('restaurant')} Nutrition Data",
                            "source_url": rhit.get("source_url"),
                        })
                        matched_any_restaurant = True
                        continue
                    # Restaurant flagged but not found — fall through to other lookups

                # --- 2. Packaged-product lookup ---
                if is_packaged and (brand_name or product_name):
                    pkg = await lookup_packaged_product(brand_name, product_name)
                    if pkg and weight > 0:
                        ratio = weight / 100.0
                        override_items.append({
                            "name": pkg.get("name") or name or "Packaged Item",
                            "brand": pkg.get("brand") or brand_name,
                            "product_name": product_name,
                            "weight_g": weight,
                            "calories": round(pkg["calories_per_100g"] * ratio),
                            "protein_g": round(pkg["protein_per_100g"] * ratio, 1),
                            "carbs_g": round(pkg["carbs_per_100g"] * ratio, 1),
                            "fat_g": round(pkg["fats_per_100g"] * ratio, 1),
                            "fiber_g": round(pkg.get("fiber_per_100g", 0) * ratio, 1),
                            "is_packaged": True,
                            "db_matched": True,
                            "source": pkg["source"].upper(),
                            "source_label": pkg["source_label"],
                        })
                        matched_any_packaged = True
                        continue
                    # Packaged but not found — keep Gemini estimate and flag it
                    any_packaged_unmatched = True
                    it["is_packaged"] = True
                    it["db_matched"] = False
                    it["brand_name"] = brand_name
                    it["product_name"] = product_name
                    it["source"] = "GEMINI_ESTIMATE"
                    it["source_label"] = "Source: Gemini Estimate — scan label for exact values"
                    override_items.append(it)
                    continue

                # --- 3. INDB (Indian food) match ---
                indb_match = indb_lookup(name) if name else None
                if indb_match and weight > 0 and (not cuisine_type or cuisine_type.lower() in ("indian", "")):
                    formatted = format_indb_result(indb_match, portion_g=weight)
                    matched_any_indb = True
                    override_items.append({
                        "name": formatted["name"],
                        "orig_name": formatted.get("orig_name"),
                        "food_code": formatted.get("food_code"),
                        "weight_g": weight,
                        "calories": formatted["calories"],
                        "protein_g": formatted["protein"],
                        "carbs_g": formatted["carbs"],
                        "fat_g": formatted["fats"],
                        "fiber_g": formatted.get("fiber"),
                        "source": "INDB_2024",
                        "source_label": "Source: ICMR-NIN INDB 2024",
                    })
                    continue

                # --- 4. Asian regional food lookup (FAO/INFOODS national tables) ---
                asian_hit = asian_food_lookup(name, cuisine_type) if name else None
                if asian_hit and weight > 0:
                    ratio = weight / 100.0
                    p100 = asian_hit.get("per_100g", {})
                    country = asian_hit.get("country", "")
                    override_items.append({
                        "name": asian_hit.get("name"),
                        "dish_name_local": dish_name_local,
                        "country": country,
                        "cuisine": asian_hit.get("cuisine"),
                        "food_code": asian_hit.get("food_code"),
                        "weight_g": weight,
                        "calories": round(float(p100.get("calories", 0)) * ratio),
                        "protein_g": round(float(p100.get("protein_g", 0)) * ratio, 1),
                        "carbs_g": round(float(p100.get("carb_g", 0)) * ratio, 1),
                        "fat_g": round(float(p100.get("fat_g", 0)) * ratio, 1),
                        "fiber_g": round(float(p100.get("fiber_g", 0)) * ratio, 1),
                        "sodium_mg": round(float(p100.get("sodium_mg", 0)) * ratio, 1),
                        "source": "FAO_INFOODS",
                        "source_label": f"Source: FAO/INFOODS {country} ({asian_hit.get('source_db', 'national FCT')})",
                    })
                    matched_any_asian = True
                    continue

                # --- 5. Fallback — Gemini estimate ---
                it["source"] = "GEMINI_ESTIMATE"
                it["source_label"] = "Source: Gemini Estimate — scan label for exact values"
                it["db_matched"] = False
                override_items.append(it)

            total = {
                "calories": round(sum(float(i.get("calories", 0) or 0) for i in override_items)),
                "protein_g": round(sum(float(i.get("protein_g", 0) or 0) for i in override_items), 1),
                "carbs_g": round(sum(float(i.get("carbs_g", 0) or 0) for i in override_items), 1),
                "fat_g": round(sum(float(i.get("fat_g", 0) or 0) for i in override_items), 1),
            }
            # If Gemini returned nothing or zero-calorie results, flag as failure
            if not override_items or total["calories"] <= 0:
                return {
                    "success": False,
                    "message": "Couldn't identify any food in the photo. Try better lighting, center the plate, and make sure the food is clearly visible — or use the Barcode/Label tabs for packaged items.",
                    "confidence": data.get("confidence", 0),
                }
            return {
                "success": True,
                "confidence": data.get("confidence", 0.7),
                "items": override_items,
                "total": total,
                "uncertain_items": data.get("uncertain_items", []),
                "indb_matched": matched_any_indb,
                "packaged_matched": matched_any_packaged,
                "packaged_unmatched": any_packaged_unmatched,
                "restaurant_matched": matched_any_restaurant,
                "asian_matched": matched_any_asian,
                "has_packaged": matched_any_packaged or any_packaged_unmatched,
                "source": INDB_SOURCE if matched_any_indb else (
                    "Restaurant Official" if matched_any_restaurant else (
                        ASIAN_SOURCE if matched_any_asian else None
                    )
                ),
            }
        except json.JSONDecodeError:
            logger.error(f"Gemini food scan parse error: {text[:500]}")
            return {
                "success": False,
                "message": "Couldn't read the photo. Please retake it with better lighting and try again.",
                "raw": text[:500],
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Gemini food scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Scan failed: {e}")


# ==================== USDA BARCODE LOOKUP ====================

@scanner_router.post("/usda-barcode")
async def usda_barcode_lookup(
    request: dict,
    user: User = Depends(get_current_user)
):
    """Lookup a barcode/UPC via USDA FoodData Central API."""
    import httpx
    api_key = os.getenv("USDA_API_KEY")
    barcode = (request.get("barcode") or "").strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode required")
    if not api_key:
        raise HTTPException(status_code=500, detail="USDA_API_KEY not configured")

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {"query": barcode, "api_key": api_key, "pageSize": 5}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(url, params=params)
            if r.status_code != 200:
                logger.error(f"USDA error {r.status_code}: {r.text[:300]}")
                raise HTTPException(status_code=502, detail="USDA API error")
            data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"USDA network error: {e}")

    foods = data.get("foods", [])
    # USDA `/foods/search?query=` does fuzzy text matching, so a non-existent UPC
    # can return unrelated documents. Require an exact gtinUpc match.
    foods = [f for f in foods if str(f.get("gtinUpc") or "").strip() == barcode]
    if not foods:
        # Fallback: OpenFoodFacts free
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                off = await client.get(
                    f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                )
                off_data = off.json()
                if off_data.get("status") == 1 and off_data.get("product"):
                    p = off_data["product"]
                    n = p.get("nutriments", {}) or {}
                    return {
                        "success": True,
                        "source": "openfoodfacts",
                        "product": {
                            "name": p.get("product_name") or "Unknown",
                            "brand": p.get("brands") or "",
                            "calories_per_100g": n.get("energy-kcal_100g") or 0,
                            "protein_per_100g": n.get("proteins_100g") or 0,
                            "carbs_per_100g": n.get("carbohydrates_100g") or 0,
                            "fats_per_100g": n.get("fat_100g") or 0,
                            "serving_size_g": p.get("serving_size", "100g"),
                        },
                    }
        except Exception:
            pass
        return {"success": False, "message": "Product not found in USDA or OpenFoodFacts."}

    f = foods[0]
    nutrients = {n.get("nutrientName") or n.get("nutrientNumber"): n.get("value") for n in f.get("foodNutrients", [])}
    return {
        "success": True,
        "source": "usda",
        "product": {
            "name": f.get("description") or "Unknown",
            "brand": f.get("brandOwner") or "",
            "calories_per_100g": nutrients.get("Energy") or nutrients.get("Energy (Atwater General Factors)") or 0,
            "protein_per_100g": nutrients.get("Protein") or 0,
            "carbs_per_100g": nutrients.get("Carbohydrate, by difference") or 0,
            "fats_per_100g": nutrients.get("Total lipid (fat)") or 0,
            "serving_size_g": f.get("servingSize") or 100,
        },
    }


# ==================== LABEL OCR via Gemini ====================

class LabelOcrRequest(BaseModel):
    image_base64: str

@scanner_router.post("/label-ocr")
async def label_ocr(
    request: LabelOcrRequest,
    user: User = Depends(get_current_user)
):
    """Read a Nutrition Facts label image via Gemini 2.5 Flash and return structured macros."""
    import json

    prompt = """You are an OCR engine reading a Nutrition Facts label. Extract all values you see and return ONLY this JSON:
{
  "product_name": string or null,
  "serving_size": string,
  "servings_per_container": number or null,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "saturated_fat_g": number or null,
  "fiber_g": number or null,
  "sugar_g": number or null,
  "sodium_mg": number or null,
  "confidence": number between 0 and 1
}

All values are PER serving (not per container). If a field cannot be read, set it to 0 or null. Numbers must be JSON numbers, not strings."""

    try:
        text = await _gemini_vision(request.image_base64, prompt)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()
        try:
            data = json.loads(text)
            # If Gemini couldn't read anything meaningful, flag as failure so frontend shows a retry prompt
            cals = float(data.get("calories") or 0)
            prot = float(data.get("protein_g") or 0)
            carbs = float(data.get("carbs_g") or 0)
            fat = float(data.get("fat_g") or 0)
            conf = float(data.get("confidence") or 0)
            if cals <= 0 and prot <= 0 and carbs <= 0 and fat <= 0:
                return {
                    "success": False,
                    "message": "Couldn't read the Nutrition Facts panel. Try a closer, sharper shot with good lighting — make sure the full panel (Calories, Protein, Carbs, Fat) is visible and not glared.",
                    "confidence": conf,
                }
            return {"success": True, **data}
        except json.JSONDecodeError:
            return {"success": False, "message": "Label text was unreadable. Please retake the photo.", "raw": text[:500]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Label OCR error: {e}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")


# Save extracted label as a personal food
class SaveLabelRequest(BaseModel):
    name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size: Optional[str] = None

@scanner_router.post("/save-label")
async def save_label_food(
    req: SaveLabelRequest,
    user: User = Depends(get_current_user)
):
    """Save an OCR'd label as a personal food entry."""
    food = {
        "user_id": user.user_id,
        "name": req.name,
        "calories": req.calories,
        "protein_g": req.protein_g,
        "carbs_g": req.carbs_g,
        "fat_g": req.fat_g,
        "serving_size": req.serving_size or "1 serving",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.user_foods.insert_one(food)
    return {"success": True, "food_id": str(res.inserted_id)}

# ==================== NUTRITION DASHBOARD ====================

@nutrition_router.get("/dashboard")
async def nutrition_dashboard(user: User = Depends(get_current_user)):
    """Daily nutrition dashboard data: macros, water, streak."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    # Today's meals
    meals_today = await db.meals.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0}
    ).to_list(100)

    # Sum macros
    consumed = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
    for m in meals_today:
        consumed["calories"] += m.get("calories", 0)
        consumed["protein"] += m.get("protein", 0)
        consumed["carbs"] += m.get("carbs", 0)
        consumed["fats"] += m.get("fats", 0)

    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    goals = {
        "calories": user_doc.get("goal_calories", 2200),
        "protein": user_doc.get("goal_protein", 150),
        "carbs": user_doc.get("goal_carbs", 250),
        "fats": user_doc.get("goal_fats", 70),
    }

    # Water (stored in dedicated collection)
    water_doc = await db.water_log.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    water_ml = water_doc.get("ml", 0) if water_doc else 0

    # Streak: count consecutive days back from today with at least one meal
    streak = 0
    cursor = datetime.now(timezone.utc).date()
    while True:
        d = cursor.strftime("%Y-%m-%d")
        cnt = await db.meals.count_documents({"user_id": user.user_id, "date": d})
        if cnt > 0:
            streak += 1
            cursor = cursor - timedelta(days=1)
        else:
            break
        if streak > 365:
            break

    return {
        "date": today,
        "consumed": {k: round(v, 1) for k, v in consumed.items()},
        "goals": goals,
        "remaining": {
            "calories": max(0, goals["calories"] - consumed["calories"]),
            "protein": max(0, goals["protein"] - consumed["protein"]),
            "carbs": max(0, goals["carbs"] - consumed["carbs"]),
            "fats": max(0, goals["fats"] - consumed["fats"]),
        },
        "over_goal": consumed["calories"] > goals["calories"],
        "water_ml": water_ml,
        "water_goal_ml": 2500,
        "streak_days": streak,
        "meal_count": len(meals_today),
    }

class WaterLogRequest(BaseModel):
    ml: int

@nutrition_router.post("/water")
async def log_water(
    req: WaterLogRequest,
    user: User = Depends(get_current_user)
):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.water_log.find_one({"user_id": user.user_id, "date": today})
    if existing:
        new_ml = (existing.get("ml", 0) or 0) + req.ml
        await db.water_log.update_one(
            {"_id": existing["_id"]},
            {"$set": {"ml": new_ml}}
        )
        return {"ml": new_ml}
    else:
        await db.water_log.insert_one({
            "user_id": user.user_id,
            "date": today,
            "ml": req.ml,
            "created_at": datetime.now(timezone.utc),
        })
        return {"ml": req.ml}

# ==================== PROGRAMS / CALENDAR TRACKING ====================

class StartProgramRequest(BaseModel):
    sport_id: str
    sport_name: str
    level: str            # beginner | intermediate | advanced
    total_weeks: int
    days_per_week: int

@programs_router.post("/start")
async def start_program(req: StartProgramRequest, user: User = Depends(get_current_user)):
    """Start (or restart) a training program. Archives any previous active program."""
    now = datetime.now(timezone.utc)
    # Archive existing active
    await db.program_progress.update_many(
        {"user_id": user.user_id, "status": "active"},
        {"$set": {"status": "archived", "archived_at": now}}
    )
    doc = {
        "progress_id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "sport_id": req.sport_id,
        "sport_name": req.sport_name,
        "level": req.level,
        "total_weeks": req.total_weeks,
        "days_per_week": req.days_per_week,
        "started_at": now,
        "status": "active",
        "completed_days": [],  # list of {week, day, date}
    }
    await db.program_progress.insert_one(doc)
    doc.pop("_id", None)
    return {"success": True, "progress": doc}


@programs_router.get("/current")
async def current_program(user: User = Depends(get_current_user)):
    """Get the user's current active program + calendar of completed days."""
    doc = await db.program_progress.find_one(
        {"user_id": user.user_id, "status": "active"},
        {"_id": 0}
    )
    if not doc:
        return {"active": None}

    completed = doc.get("completed_days", [])
    total_days = doc.get("total_weeks", 0) * doc.get("days_per_week", 0)
    pct = round(100 * len(completed) / total_days) if total_days > 0 else 0

    # Determine current week/day = next day to do
    completed_set = {(c["week"], c["day"]) for c in completed}
    current_week, current_day = 1, 1
    for w in range(1, doc["total_weeks"] + 1):
        for d in range(1, doc["days_per_week"] + 1):
            if (w, d) not in completed_set:
                current_week, current_day = w, d
                break
        else:
            continue
        break

    return {
        "active": doc,
        "completed_count": len(completed),
        "total_days": total_days,
        "completion_pct": pct,
        "current_week": current_week,
        "current_day": current_day,
    }


class CompleteDayRequest(BaseModel):
    week: int
    day: int

@programs_router.post("/complete-day")
async def complete_day(req: CompleteDayRequest, user: User = Depends(get_current_user)):
    """Mark a specific (week, day) as complete for the active program."""
    doc = await db.program_progress.find_one({"user_id": user.user_id, "status": "active"})
    if not doc:
        raise HTTPException(status_code=404, detail="No active program")
    completed = doc.get("completed_days", [])
    # idempotent
    if any(c["week"] == req.week and c["day"] == req.day for c in completed):
        return {"success": True, "already_done": True}
    completed.append({
        "week": req.week,
        "day": req.day,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    })
    await db.program_progress.update_one(
        {"_id": doc["_id"]},
        {"$set": {"completed_days": completed, "last_session": datetime.now(timezone.utc)}}
    )
    return {"success": True, "completed_count": len(completed)}


@programs_router.post("/restart")
async def restart_program(user: User = Depends(get_current_user)):
    """Reset completed days for the active program (same sport + level)."""
    doc = await db.program_progress.find_one({"user_id": user.user_id, "status": "active"})
    if not doc:
        raise HTTPException(status_code=404, detail="No active program")
    await db.program_progress.update_one(
        {"_id": doc["_id"]},
        {"$set": {"completed_days": [], "restarted_at": datetime.now(timezone.utc)}}
    )
    return {"success": True}


@programs_router.delete("/current")
async def abandon_program(user: User = Depends(get_current_user)):
    """Abandon the active program."""
    res = await db.program_progress.update_many(
        {"user_id": user.user_id, "status": "active"},
        {"$set": {"status": "abandoned", "abandoned_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "modified": res.modified_count}


@programs_router.get("/history")
async def program_history(user: User = Depends(get_current_user)):
    """Return all past programs (archived/abandoned)."""
    docs = await db.program_progress.find(
        {"user_id": user.user_id, "status": {"$ne": "active"}},
        {"_id": 0}
    ).sort("started_at", -1).limit(20).to_list(20)
    return {"history": docs}


# ==================== AI NUTRITION COACH ====================

class SnoozeRequest(BaseModel):
    insight_id: str
    hours: int = 24

@coach_router.post("/snooze")
async def snooze_insight(req: SnoozeRequest, user: User = Depends(get_current_user)):
    """Snooze a specific insight for N hours."""
    expires = datetime.now(timezone.utc) + timedelta(hours=req.hours)
    await db.coach_snoozes.update_one(
        {"user_id": user.user_id, "insight_id": req.insight_id},
        {"$set": {"expires_at": expires, "user_id": user.user_id, "insight_id": req.insight_id}},
        upsert=True,
    )
    return {"success": True, "expires_at": expires.isoformat()}


@coach_router.get("/insights")
async def coach_insights(user: User = Depends(get_current_user)):
    """Run all coach rules and return prioritized insights with user's exact numbers."""
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    insights = []

    # Load active snoozes
    snooze_cursor = db.coach_snoozes.find({"user_id": user.user_id, "expires_at": {"$gt": now}})
    snoozed = {s["insight_id"] async for s in snooze_cursor}

    # Get user data
    user_doc = await db.users.find_one({"user_id": user.user_id}) or {}
    goal_type = user_doc.get("goal_type")
    weight_kg = user_doc.get("weight_kg") or user_doc.get("weight") or 0
    age = user_doc.get("age") or 30
    sex = user_doc.get("biological_sex") or "male"
    height_cm = user_doc.get("height_cm") or 175
    activity_level = user_doc.get("activity_level") or "moderately_active"
    target_calories = user_doc.get("goal_calories") or 2200
    target_protein = user_doc.get("goal_protein") or 150

    activity_mult = {
        "sedentary": 1.2, "lightly_active": 1.375, "moderately_active": 1.55,
        "very_active": 1.725, "extra_active": 1.9
    }.get(activity_level, 1.55)

    # Weight history (last 60 days)
    cutoff_60 = now - timedelta(days=60)
    measurements = await db.body_measurements.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff_60.strftime("%Y-%m-%d")}},
        {"_id": 0}
    ).sort("date", 1).to_list(200)

    # Meals last 14 days
    cutoff_14 = (now - timedelta(days=14)).strftime("%Y-%m-%d")
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff_14}},
        {"_id": 0}
    ).sort("date", -1).to_list(500)

    # Group meals by date
    meals_by_date = {}
    for m in meals:
        d = m.get("date")
        if not d:
            continue
        meals_by_date.setdefault(d, []).append(m)

    # ---------- RULE: PLATEAU DETECTION (cutting only) ----------
    if goal_type == "lose_fat" and len(measurements) >= 2:
        last_14 = [m for m in measurements
                   if datetime.strptime(m["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                   >= now - timedelta(days=14)]
        if len(last_14) >= 2:
            weights = [m.get("weight_kg") for m in last_14 if m.get("weight_kg")]
            if len(weights) >= 2:
                delta = weights[-1] - weights[0]
                if abs(delta) <= 0.5:
                    days_span = (
                        datetime.strptime(last_14[-1]["date"], "%Y-%m-%d")
                        - datetime.strptime(last_14[0]["date"], "%Y-%m-%d")
                    ).days
                    # Calculate plateau-busting suggestions in priority order
                    suggestions = []

                    # 1. Calorie Audit
                    suggestions.append({
                        "title": "Calorie Audit",
                        "body": "You may be underestimating portions. Try weighing your food for 3 days to verify your actual intake matches your logged intake.",
                    })

                    # 2. Recalculated TDEE based on current weight
                    current_w = weights[-1]
                    if sex == "male":
                        bmr = 10 * current_w + 6.25 * height_cm - 5 * age + 5
                    else:
                        bmr = 10 * current_w + 6.25 * height_cm - 5 * age - 161
                    new_tdee = round(bmr * activity_mult)
                    new_target = new_tdee - 400  # standard cut
                    suggestions.append({
                        "title": "Update Calorie Target",
                        "body": f"Your TDEE has decreased as you've lost weight. Based on your current weight ({current_w}kg), your new TDEE is {new_tdee} kcal and a moderate cut target is {new_target} kcal.",
                    })

                    # 3. Diet Break (if cutting > 8 weeks)
                    weeks_cutting = days_span // 7 + 4  # at least 4 weeks if plateau is 14d
                    suggestions.append({
                        "title": "Diet Break",
                        "body": f"You've been in a deficit for ~{weeks_cutting} weeks. A 1-2 week diet break at maintenance ({new_tdee} kcal) can reset leptin and improve fat loss.",
                    })

                    # 4. Refeed
                    refeed_carbs = round((new_tdee - 0.25 * new_tdee - target_protein * 4) / 4)
                    suggestions.append({
                        "title": "Refeed Day",
                        "body": f"Try eating at maintenance ({new_tdee} kcal) one day this week — specifically higher carbs (~{refeed_carbs}g). This restores glycogen and key hormones.",
                    })

                    # 5. Protein Check
                    protein_target = round(weight_kg * 1.8)
                    avg_p = 0
                    if meals_by_date:
                        all_proteins = [
                            sum(m.get("protein", 0) for m in ms)
                            for ms in meals_by_date.values()
                        ]
                        avg_p = sum(all_proteins) / len(all_proteins)
                    if avg_p < protein_target * 0.9:
                        suggestions.append({
                            "title": "Protein Check",
                            "body": f"You're averaging {round(avg_p)}g protein/day. Increasing to {protein_target}g preserves muscle during your cut and improves satiety.",
                        })

                    insights.append({
                        "id": "plateau",
                        "type": "plateau",
                        "priority": 100,
                        "severity": "warn",
                        "title": "Progress has stalled",
                        "message": f"Your weight has only changed by {round(delta, 1)}kg in the last {days_span} days while cutting.",
                        "science": "Energy balance research shows that as body mass decreases, TDEE drops too — this is metabolic adaptation. Adjusting intake or taking a diet break is well-supported by Trexler et al. (2014) and others.",
                        "data": {"delta_kg": round(delta, 2), "days": days_span, "current_weight": weights[-1]},
                        "suggestions": suggestions,
                    })

    # ---------- RULE: SAME DIET WARNING ----------
    if not insights or True:
        # Hash each day's meal names sorted
        day_signatures = {}
        for d, ms in meals_by_date.items():
            names = sorted([m.get("name", "").strip().lower() for m in ms if m.get("name")])
            if not names:
                continue
            sig = "|".join(names)
            day_signatures[d] = sig
        # Find longest streak of identical signatures across consecutive days
        sorted_days = sorted(day_signatures.keys(), reverse=True)
        streak = 1
        if len(sorted_days) >= 2:
            for i in range(1, len(sorted_days)):
                d_prev = datetime.strptime(sorted_days[i - 1], "%Y-%m-%d")
                d_now = datetime.strptime(sorted_days[i], "%Y-%m-%d")
                if (d_prev - d_now).days != 1:
                    break
                if day_signatures[sorted_days[i - 1]] == day_signatures[sorted_days[i]]:
                    streak += 1
                else:
                    break
        if streak >= 5:
            # Pull pantry items for recipe ideas
            pantry = await db.pantry_items.find(
                {"user_id": user.user_id}, {"_id": 0}
            ).to_list(20)
            pantry_names = [p.get("name") or p.get("item_name") for p in pantry][:5]
            recipes = []
            if pantry_names:
                recipes = [
                    f"Stir-fry with {pantry_names[0]}" + (f" + {pantry_names[1]}" if len(pantry_names) > 1 else ""),
                    f"Bowl with {pantry_names[2 if len(pantry_names) > 2 else 0]} as the base",
                    f"Wrap or roll featuring {pantry_names[-1]}",
                ]
            else:
                recipes = [
                    "High-protein omelet with vegetables",
                    "Greek yogurt + berries + nut butter bowl",
                    "Chicken + rice + roasted veg plate",
                ]
            insights.append({
                "id": "same_diet",
                "type": "same_diet",
                "priority": 60,
                "severity": "info",
                "title": f"{streak} days of identical meals",
                "message": f"You've eaten the same meals for {streak} days. Consistency is great — but variety ensures you cover all micronutrients.",
                "science": "USDA dietary guidelines and the EAT-Lancet report both recommend rotating ≥30 plant species/week to maximize micronutrient diversity.",
                "data": {"streak_days": streak},
                "suggestions": [{"title": r, "body": ""} for r in recipes],
            })

    # ---------- RULE: WEEKLY REVIEW (Sundays) ----------
    is_sunday = now.weekday() == 6  # Mon=0..Sun=6
    week_start = (now - timedelta(days=now.weekday() + 1)).date()  # last Sunday
    if is_sunday or True:  # always available, prioritized on Sunday
        week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        week_meals = [m for m in meals if m.get("date") in week_dates]
        if week_meals:
            daily_kcal = {}
            daily_protein = {}
            for m in week_meals:
                d = m["date"]
                daily_kcal[d] = daily_kcal.get(d, 0) + (m.get("calories") or 0)
                daily_protein[d] = daily_protein.get(d, 0) + (m.get("protein") or 0)
            avg_kcal = round(sum(daily_kcal.values()) / max(1, len(daily_kcal)))
            avg_protein = round(sum(daily_protein.values()) / max(1, len(daily_protein)))
            protein_pct = round(100 * avg_protein / max(1, target_protein))

            # Weight change in week
            week_weights = [
                m.get("weight_kg") for m in measurements
                if m.get("date") in week_dates and m.get("weight_kg")
            ]
            weight_change = 0
            if len(week_weights) >= 2:
                weight_change = round(week_weights[-1] - week_weights[0], 2)

            # Workouts last 7 days
            cutoff_7 = (now - timedelta(days=7))
            workouts = await db.workouts.find(
                {"user_id": user.user_id, "completed_at": {"$gte": cutoff_7}},
                {"_id": 0, "exercises": 0}
            ).to_list(20)
            workouts_done = len(workouts)

            # Estimated fat loss
            kcal_diff = (target_calories - avg_kcal) * 7
            est_kg = round(kcal_diff / 7700, 2) if goal_type == "lose_fat" else None

            summary = (
                f"This week you averaged {avg_kcal} kcal against your {target_calories} kcal goal. "
                f"Protein was {avg_protein}g ({protein_pct}% of {target_protein}g target). "
                f"You completed {workouts_done} workouts. "
            )
            if est_kg is not None:
                summary += f"Estimated fat loss this week: ~{est_kg}kg."

            # Pick weakest area
            weakest_area = "calories"
            if protein_pct < 80:
                weakest_area = "protein"
                action = f"Hit {target_protein}g protein next week (you were {avg_protein}g). Add 1 protein-forward meal per day."
            elif workouts_done < 3:
                weakest_area = "consistency"
                action = "Aim for 3-4 workouts next week. Schedule them as calendar events."
            elif goal_type == "lose_fat" and avg_kcal > target_calories + 100:
                action = f"Cut ~{avg_kcal - target_calories} kcal/day to stay on track."
            elif goal_type == "build_muscle" and avg_kcal < target_calories - 100:
                action = f"Add ~{target_calories - avg_kcal} kcal/day to hit your surplus."
            else:
                action = "Keep doing what you're doing — solid week."

            insights.append({
                "id": f"weekly_{week_start.strftime('%Y%m%d')}",
                "type": "weekly_review",
                "priority": 90 if is_sunday else 50,
                "severity": "info",
                "title": "Weekly Review",
                "message": summary,
                "science": "Weekly averages smooth daily noise — they're a more accurate signal of progress than any single day, per Hall (2008).",
                "data": {
                    "avg_kcal": avg_kcal, "target_kcal": target_calories,
                    "avg_protein": avg_protein, "target_protein": target_protein,
                    "weight_change_kg": weight_change,
                    "workouts_done": workouts_done,
                    "estimated_change_kg": est_kg,
                },
                "suggestions": [{"title": f"Focus area: {weakest_area}", "body": action}],
            })

    # ---------- RULE: CUTTING DEFICIT TRACKER ----------
    if goal_type == "lose_fat":
        # 7-day window
        cutoff_7d = (now - timedelta(days=7)).strftime("%Y-%m-%d")
        recent_meals = [m for m in meals if m.get("date", "") >= cutoff_7d]
        if recent_meals:
            kcal_per_day = {}
            for m in recent_meals:
                d = m["date"]
                kcal_per_day[d] = kcal_per_day.get(d, 0) + (m.get("calories") or 0)
            days_logged = len(kcal_per_day)
            avg_kcal = round(sum(kcal_per_day.values()) / days_logged) if days_logged else 0
            # TDEE (use stored or recalc)
            tdee_now = user_doc.get("tdee") or round(
                (10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "male" else -161)) * activity_mult
            )
            daily_deficit = tdee_now - avg_kcal
            weekly_deficit = daily_deficit * 7
            est_loss_week = round(weekly_deficit / 7700, 2)

            # Time to goal weight (assume goal is 5kg below current if not set)
            goal_weight = user_doc.get("goal_weight_kg") or (weight_kg - 5)
            kg_to_go = max(0, weight_kg - goal_weight)
            weeks_to_goal = round(kg_to_go / max(0.05, est_loss_week)) if est_loss_week > 0 else None

            # Warnings
            warnings = []
            if daily_deficit > 500:
                warnings.append({
                    "title": "Aggressive deficit",
                    "body": f"Your daily deficit of {daily_deficit} kcal exceeds the recommended max of 500. This may cause muscle loss. Consider eating ~{tdee_now - 500} kcal/day instead.",
                })

            # Protein during cut
            avg_p_cut = sum(
                sum(m.get("protein", 0) for m in ms) for ms in meals_by_date.values()
            ) / max(1, len(meals_by_date))
            protein_min = weight_kg * 1.8
            if avg_p_cut < protein_min:
                warnings.append({
                    "title": "Low protein during cut",
                    "body": f"Average protein is {round(avg_p_cut)}g/day, below {round(protein_min)}g (1.8g/kg). Increase protein to preserve lean mass.",
                    "highlight_protein_red": True,
                })

            insights.append({
                "id": "cutting_deficit",
                "type": "cutting_deficit",
                "priority": 80,
                "severity": "info" if not warnings else "warn",
                "title": "Cut tracker",
                "message": f"Weekly deficit: {weekly_deficit} kcal · est. loss this week: ~{est_loss_week}kg.",
                "science": "1 kg of body fat ≈ 7700 kcal. Sustainable cuts target 0.5-1% body weight loss per week (Helms et al. 2014).",
                "data": {
                    "daily_deficit": daily_deficit, "weekly_deficit": weekly_deficit,
                    "est_loss_week_kg": est_loss_week,
                    "weeks_to_goal": weeks_to_goal, "goal_weight_kg": goal_weight,
                    "tdee": tdee_now, "avg_kcal": avg_kcal,
                },
                "suggestions": warnings,
            })

    # ---------- RULE: BULKING UNDER-EATING ----------
    if goal_type == "build_muscle":
        cutoff_3d = (now - timedelta(days=3)).strftime("%Y-%m-%d")
        recent = [m for m in meals if m.get("date", "") >= cutoff_3d]
        if recent:
            kcal_3 = {}
            for m in recent:
                d = m["date"]
                kcal_3[d] = kcal_3.get(d, 0) + (m.get("calories") or 0)
            days_under = sum(1 for v in kcal_3.values() if v < target_calories - 100)
            if days_under >= 3:
                insights.append({
                    "id": "bulk_under",
                    "type": "bulking_under",
                    "priority": 80,
                    "severity": "warn",
                    "title": "Under your surplus",
                    "message": f"You've been under {target_calories} kcal for {days_under} days. To maximize muscle growth, hit your target consistently.",
                    "science": "Lean bulks of 200-400 kcal/day produce optimal muscle gain with minimal fat (Slater & Phillips 2011).",
                    "data": {"days_under": days_under, "target": target_calories},
                    "suggestions": [{"title": "Add a snack", "body": f"A protein shake + banana adds ~350 kcal effortlessly."}],
                })
            # Weekly muscle gain estimate
            tdee_now = user_doc.get("tdee") or target_calories - 250
            avg_kcal_3 = sum(kcal_3.values()) / max(1, len(kcal_3))
            surplus = avg_kcal_3 - tdee_now
            if 200 <= surplus <= 500:
                low = round(surplus / 7700 * 7 * 0.5, 2)
                high = round(surplus / 7700 * 7, 2)
                insights.append({
                    "id": "bulk_estimate",
                    "type": "bulking_estimate",
                    "priority": 50,
                    "severity": "success",
                    "title": "Optimal lean bulk",
                    "message": f"At your current surplus ({round(surplus)} kcal/day) you're in the optimal range for ~{low}-{high}kg/wk lean muscle gain.",
                    "science": "200-500 kcal surplus optimizes muscle:fat gain ratio (Slater & Phillips 2011).",
                    "data": {"surplus": round(surplus), "estimate_low": low, "estimate_high": high},
                    "suggestions": [],
                })

    # ---------- RULE: MAINTENANCE ----------
    if goal_type == "maintain":
        cutoff_14d = (now - timedelta(days=14)).strftime("%Y-%m-%d")
        recent = [m for m in meals if m.get("date", "") >= cutoff_14d]
        if recent:
            kcal_14 = {}
            for m in recent:
                d = m["date"]
                kcal_14[d] = kcal_14.get(d, 0) + (m.get("calories") or 0)
            avg_kcal_14 = sum(kcal_14.values()) / max(1, len(kcal_14))
            tdee_now = user_doc.get("tdee") or target_calories
            diff = avg_kcal_14 - tdee_now
            if diff > 100:
                insights.append({
                    "id": "maint_over",
                    "type": "maintenance",
                    "priority": 60,
                    "severity": "info",
                    "title": "Trending up",
                    "message": f"You've averaged {round(avg_kcal_14)} kcal/day vs {tdee_now} TDEE — drop 100-200 kcal/day to hold weight.",
                    "science": "Weight is regulated by long-term energy balance, not single days.",
                    "data": {"avg_kcal": round(avg_kcal_14), "tdee": tdee_now, "diff": round(diff)},
                    "suggestions": [],
                })
            elif diff < -100:
                insights.append({
                    "id": "maint_under",
                    "type": "maintenance",
                    "priority": 60,
                    "severity": "info",
                    "title": "Eating below maintenance",
                    "message": f"You've averaged {round(avg_kcal_14)} kcal/day vs {tdee_now} TDEE — add 100-200 kcal/day if you intended to maintain.",
                    "science": "Sustained underconsumption can drop NEAT and impact recovery (Trexler 2014).",
                    "data": {"avg_kcal": round(avg_kcal_14), "tdee": tdee_now, "diff": round(diff)},
                    "suggestions": [],
                })

    # Filter out snoozed and sort by priority
    insights = [i for i in insights if i["id"] not in snoozed]
    insights.sort(key=lambda x: x.get("priority", 0), reverse=True)
    return {"insights": insights, "count": len(insights)}


# ==================== MAIN ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "Fitness Command Center API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include routers
api_router.include_router(auth_router)
api_router.include_router(workout_router)
api_router.include_router(exercise_router)
api_router.include_router(nutrition_router)
api_router.include_router(user_router)
api_router.include_router(pantry_router)
api_router.include_router(onboarding_router)
api_router.include_router(measurements_router)
api_router.include_router(templates_router)
api_router.include_router(scanner_router)
api_router.include_router(programs_router)
api_router.include_router(coach_router)
api_router.include_router(shopping_router)
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
