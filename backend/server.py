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
    goal_calories: int = 2200
    goal_protein: int = 150
    goal_carbs: int = 250
    goal_fats: int = 70
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
