import os

# Check what's actually in the environment
vars_to_check = [
    "B2_KEY_ID", "B2_APP_KEY",
    "B2_ACCOUNT_1_KEY_ID", "B2_ACCOUNT_1_APP_KEY",
    "B2_ACCOUNT_2_KEY_ID", "B2_ACCOUNT_2_APP_KEY",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY",
]

print("Environment variables:")
for var in vars_to_check:
    val = os.environ.get(var)
    if val:
        print(f"  {var} = {val[:6]}...{val[-4:]}")  # partial for security
    else:
        print(f"  {var} = NOT SET")

# Check where cloud_sync_engine loads its credentials from
# Look for .env file
env_file = r"C:\Users\balik\Iven\my_lab\.env"
if os.path.exists(env_file):
    print(f"\n.env file exists at {env_file}")
    with open(env_file) as f:
        for line in f:
            if "KEY" in line or "SECRET" in line or "B2" in line:
                k = line.split("=")[0].strip()
                v = line.split("=")[1].strip() if "=" in line else ""
                print(f"  {k} = {v[:6]}...{v[-4:] if len(v) > 10 else '(too short or empty)'}")
else:
    print(f"\nNo .env file found at {env_file}")
