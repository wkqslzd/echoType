"""Cognito PreSignUp: block native SignUp when email already exists (incl. Google_*).

ExternalProvider (Google) is always allowed so app-side L2 linking still works.
"""

from __future__ import annotations

import boto3

client = boto3.client("cognito-idp")

EMAIL_EXISTS_MESSAGE = (
    "An account with this email already exists. Try signing in with Google instead."
)


def handler(event, _context):
    trigger = event.get("triggerSource") or ""

    # Google / other IdP first entry into the pool — do not reject on email clash.
    if trigger.startswith("PreSignUp_ExternalProvider"):
        event.setdefault("response", {})
        event["response"]["autoConfirmUser"] = True
        event["response"]["autoVerifyEmail"] = True
        return event

    if trigger in ("PreSignUp_SignUp", "PreSignUp_AdminCreateUser"):
        attrs = (event.get("request") or {}).get("userAttributes") or {}
        email = (attrs.get("email") or "").strip().lower()
        if email:
            pool_id = event.get("userPoolId")
            if not pool_id:
                raise Exception("userPoolId missing from PreSignUp event")
            # Escape quotes in filter value (emails should not contain ", but be safe).
            safe = email.replace("\\", "\\\\").replace('"', '\\"')
            resp = client.list_users(
                UserPoolId=pool_id,
                Filter=f'email = "{safe}"',
                Limit=1,
            )
            if resp.get("Users"):
                raise Exception(EMAIL_EXISTS_MESSAGE)

    return event
