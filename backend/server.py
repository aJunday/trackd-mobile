from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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
    # Calculated values
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
        "exercises": [
            {"exercise_name": "Bench Press", "sets": 4},
            {"exercise_name": "Overhead Press", "sets": 3},
            {"exercise_name": "Incline Dumbbell Press", "sets": 3},
            {"exercise_name": "Lateral Raise", "sets": 3},
            {"exercise_name": "Tricep Pushdown", "sets": 3}
        ]
    },
    {
        "template_id": "preset_pull",
        "name": "Pull Day",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Deadlift", "sets": 3},
            {"exercise_name": "Barbell Row", "sets": 4},
            {"exercise_name": "Lat Pulldown", "sets": 3},
            {"exercise_name": "Face Pull", "sets": 3},
            {"exercise_name": "Barbell Curl", "sets": 3}
        ]
    },
    {
        "template_id": "preset_legs",
        "name": "Leg Day",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Squat", "sets": 4},
            {"exercise_name": "Romanian Deadlift", "sets": 3},
            {"exercise_name": "Leg Press", "sets": 3},
            {"exercise_name": "Leg Curl", "sets": 3},
            {"exercise_name": "Calf Raise", "sets": 4}
        ]
    },
    {
        "template_id": "preset_upper",
        "name": "Upper Body",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Bench Press", "sets": 4},
            {"exercise_name": "Barbell Row", "sets": 4},
            {"exercise_name": "Overhead Press", "sets": 3},
            {"exercise_name": "Lat Pulldown", "sets": 3},
            {"exercise_name": "Dumbbell Curl", "sets": 3}
        ]
    },
    {
        "template_id": "preset_lower",
        "name": "Lower Body",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Squat", "sets": 4},
            {"exercise_name": "Romanian Deadlift", "sets": 4},
            {"exercise_name": "Leg Press", "sets": 3},
            {"exercise_name": "Leg Extension", "sets": 3},
            {"exercise_name": "Leg Curl", "sets": 3}
        ]
    },
    {
        "template_id": "preset_fullbody",
        "name": "Full Body",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Squat", "sets": 3},
            {"exercise_name": "Bench Press", "sets": 3},
            {"exercise_name": "Barbell Row", "sets": 3},
            {"exercise_name": "Overhead Press", "sets": 3},
            {"exercise_name": "Romanian Deadlift", "sets": 3}
        ]
    },
    {
        "template_id": "preset_ppl",
        "name": "PPL",
        "is_preset": True,
        "exercises": [
            {"exercise_name": "Squat", "sets": 4},
            {"exercise_name": "Bench Press", "sets": 4},
            {"exercise_name": "Barbell Row", "sets": 4},
            {"exercise_name": "Overhead Press", "sets": 3},
            {"exercise_name": "Deadlift", "sets": 3}
        ]
    }
]

@templates_router.get("")
async def get_templates(user: User = Depends(get_current_user)):
    """Get all workout templates (preset + user created)."""
    user_templates = await db.workout_templates.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "presets": PRESET_TEMPLATES,
        "user_templates": user_templates
    }

@templates_router.post("")
async def save_template(
    template_data: dict,
    user: User = Depends(get_current_user)
):
    """Save a workout as a template."""
    template = WorkoutTemplate(
        user_id=user.user_id,
        name=template_data.get("name", "My Template"),
        exercises=template_data.get("exercises", []),
        is_preset=False
    )
    
    await db.workout_templates.insert_one(template.dict())
    return template.dict()

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
