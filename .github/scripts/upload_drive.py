#!/usr/bin/env python3
import json, os, sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

creds_json = os.environ["GDRIVE_CREDENTIALS"]
folder_id  = os.environ["GDRIVE_FOLDER_ID"]
file_path  = sys.argv[1]
file_name  = os.path.basename(file_path)

creds = service_account.Credentials.from_service_account_info(
    json.loads(creds_json),
    scopes=["https://www.googleapis.com/auth/drive"],
)
service = build("drive", "v3", credentials=creds)

# Borrar versión anterior con el mismo nombre para que el link no cambie
existing = service.files().list(
    q=f"name='{file_name}' and '{folder_id}' in parents and trashed=false",
    fields="files(id)",
).execute()
for f in existing.get("files", []):
    service.files().delete(fileId=f["id"]).execute()

media = MediaFileUpload(file_path, resumable=True)
result = service.files().create(
    body={"name": file_name, "parents": [folder_id]},
    media_body=media,
    fields="id,name",
).execute()
print(f"Subido: {result['name']} (id={result['id']})")
