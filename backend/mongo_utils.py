from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

# Lấy cấu hình từ biến môi trường hoặc dùng giá trị mặc định
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB = os.getenv("MONGO_DB", "mekong_museum")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

def find_all(col):
    return list(db[col].find({}, {"_id": 0}))

def find_one(col, query):
    return db[col].find_one(query, {"_id": 0})

def insert_one(col, data):
    db[col].insert_one(data)

def update_one(col, query, update):
    db[col].update_one(query, {"$set": update})

def delete_one(col, query):
    db[col].delete_one(query)

def insert_many(col, docs):
    if docs:
        db[col].insert_many(docs)