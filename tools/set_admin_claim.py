"""Set the trusted Firebase Auth custom claim required by admin.html.

Run this only on a trusted computer with a private service-account key stored
outside the project directory. Never commit or upload that key.
"""

import argparse
from pathlib import Path

import firebase_admin
from firebase_admin import auth, credentials, db


def main() -> None:
    parser = argparse.ArgumentParser(description="Grant admin: true and an admin profile to a Firebase Auth user")
    parser.add_argument("user", help="Firebase Authentication UID or email address")
    parser.add_argument("--credentials", required=True, type=Path, help="Path to the service-account JSON file (keep it outside the project)")
    args = parser.parse_args()

    if not args.credentials.is_file():
        parser.error("service-account JSON file was not found")

    credential = credentials.Certificate(str(args.credentials.resolve()))
    firebase_admin.initialize_app(credential, {
        "databaseURL": "https://travel-30c1b-default-rtdb.asia-southeast1.firebasedatabase.app/"
    })
    user = auth.get_user_by_email(args.user) if "@" in args.user else auth.get_user(args.user)
    claims = dict(user.custom_claims or {})
    claims["admin"] = True
    auth.set_custom_user_claims(user.uid, claims)
    profile_ref = db.reference(f"members/{user.uid}")
    profile = profile_ref.get() or {}
    profile.update({"name": profile.get("name") or user.display_name or "관리자", "email": user.email or "", "phone": profile.get("phone") or "", "role": "admin", "status": profile.get("status") or "active"})
    profile.setdefault("createdAt", {".sv": "timestamp"})
    profile["updatedAt"] = {".sv": "timestamp"}
    profile_ref.set(profile)
    print(f"Admin claim and profile enabled for {user.email} (UID: {user.uid})")
    print("Sign out and sign in again so Firebase Auth refreshes the ID token.")


if __name__ == "__main__":
    main()
