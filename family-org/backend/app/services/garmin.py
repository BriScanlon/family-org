from datetime import datetime, timedelta

from garminconnect import Garmin
from sqlalchemy.orm import Session

from ..models import GarminActivity, User
from .encryption import decrypt


async def sync_activities(user: User, db: Session) -> dict:
    """Sync Garmin Connect activities for a user.

    Fetches activities from the last 7 days, deduplicates by garmin_activity_id,
    and prunes activities older than 14 days.

    Returns dict with keys: synced (int), error (str|None)
    """
    try:
        email = user.garmin_email
        password = decrypt(user.garmin_password)

        client = Garmin(email, password)
        client.login()

        # Fetch activities from last 7 days
        today = datetime.now()
        start_date = today - timedelta(days=7)
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = today.strftime("%Y-%m-%d")

        activities = client.get_activities_by_date(start_str, end_str)

        synced = 0

        for activity in activities:
            garmin_id = str(activity.get("activityId", ""))
            if not garmin_id:
                continue

            # Skip if already in DB
            existing = (
                db.query(GarminActivity)
                .filter(GarminActivity.garmin_activity_id == garmin_id)
                .first()
            )
            if existing:
                continue

            # Parse start_time
            start_time_str = activity.get("startTimeLocal")
            start_time = None
            if start_time_str:
                for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        start_time = datetime.strptime(start_time_str, fmt)
                        break
                    except ValueError:
                        continue

            # Extract activity_type from nested activityType dict
            activity_type_obj = activity.get("activityType", {})
            activity_type = activity_type_obj.get("typeKey", "unknown") if isinstance(activity_type_obj, dict) else "unknown"

            # Extract optional numeric fields safely
            distance = activity.get("distance")
            calories = activity.get("calories")
            average_hr = activity.get("averageHR")

            record = GarminActivity(
                user_id=user.id,
                garmin_activity_id=garmin_id,
                activity_type=activity_type,
                name=activity.get("activityName", "Untitled"),
                start_time=start_time or datetime.now(),
                duration_seconds=int(activity.get("duration", 0)),
                distance_meters=float(distance) if distance is not None else None,
                calories=int(calories) if calories is not None else None,
                average_hr=int(average_hr) if average_hr is not None else None,
            )
            db.add(record)
            synced += 1

        # Prune activities older than 14 days for this user
        cutoff = datetime.now() - timedelta(days=14)
        db.query(GarminActivity).filter(
            GarminActivity.user_id == user.id,
            GarminActivity.start_time < cutoff,
        ).delete(synchronize_session=False)

        db.commit()
        return {"synced": synced, "error": None}

    except Exception as e:
        db.rollback()
        return {"synced": 0, "error": str(e)[:200]}
