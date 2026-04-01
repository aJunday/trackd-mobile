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
app = FastAPI(title="Fitness Command Center API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["auth"])
workout_router = APIRouter(prefix="/workouts", tags=["workouts"])
exercise_router = APIRouter(prefix="/exercises", tags=["exercises"])
nutrition_router = APIRouter(prefix="/nutrition", tags=["nutrition"])
user_router = APIRouter(prefix="/users", tags=["users"])

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
    weight: Optional[float] = None
    height: Optional[float] = None  # in cm
    age: Optional[int] = None
    gender: Optional[str] = None  # 'male', 'female', 'other'
    activity_level: Optional[str] = "moderate"  # sedentary, light, moderate, active, very_active
    goal_type: str = "maintenance"  # cutting, maintenance, bulking
    goal_calories: int = 2200
    goal_protein: int = 150  # grams
    goal_carbs: int = 250  # grams
    goal_fats: int = 70  # grams
    protein_percent: int = 30
    carbs_percent: int = 40
    fats_percent: int = 30
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
