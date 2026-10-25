# 🚀 BloodLink — Deployment & Version Control Guide

This guide explains how to version control BloodLink with **Git/GitHub** and deploy it to **Render** or **Railway**.

---

## 📦 1. Database Architecture: Local `mongod` vs. Cloud Deployment

### A. Local Machine Operation (Already Active)
- **Engine**: MongoDB Native Driver (`MongoClient`) via official `mongodb` package.
- **Connection URI**: `mongodb://127.0.0.1:27017`
- **Database**: `bloodlink_db`
- **Windows Service**: `MongoDB Server (MongoDB)` running locally.
- **Initialization**: Run `npm run db:init` to create all collections, unique compound indexes, and demo accounts.
- **Start Local Server**: `npm start` (opens on `http://localhost:5000`).

---

## 🌿 2. Version Control with Git & GitHub

The local Git repository is already initialized on branch `main`.

### Step-by-Step GitHub Setup:
1. Open your browser and go to [GitHub](https://github.com) and log in.
2. Click **New Repository**:
   - Repository Name: `bloodlink` (or any preferred name)
   - Visibility: **Public** or **Private**
   - **Do NOT** check "Initialize with README", .gitignore, or license (these already exist locally).
   - Click **Create repository**.
3. Copy your GitHub repository URL (e.g., `https://github.com/<your-username>/bloodlink.git`).
4. In your terminal or PowerShell inside this directory (`c:\Users\dell6\OneDrive\Desktop\fsd_inv_fin`), run:
   ```powershell
   git remote add origin https://github.com/<your-username>/bloodlink.git
   git branch -M main
   git push -u origin main
   ```

---

## ☁️ 3. Deploying to Render (Free Tier)

Render allows you to host Node.js web services directly linked to your GitHub repository.

### Option A: Direct Web Service on Render (Recommended)
1. Go to [Render.com](https://render.com) and sign in with your GitHub account.
2. Click **New +** $\rightarrow$ **Web Service**.
3. Connect your **bloodlink** repository.
4. Fill in the deployment settings:
   - **Name**: `bloodlink-live`
   - **Environment**: `Node`
   - **Region**: Choose the closest region (e.g., Singapore / Frankfurt / Oregon)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run db:init && npm start`
   - **Plan**: `Free`
5. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `PORT` = `10000`
   - `SESSION_SECRET` = `<any-random-secure-string>`
   - `DB_NAME` = `bloodlink_db`
   - `MONGO_URI` = `<Your MongoDB Connection String>` *(Note: Cloud web services require a reachable MongoDB URI. You can create a free MongoDB Atlas URI or Render/Railway hosted database for live cloud traffic, or use MongoDB Atlas M0 Free Cluster)*.
6. Click **Create Web Service**. Render will deploy your application and provide a free live URL (e.g., `https://bloodlink-live.onrender.com`).

---

## 🚂 4. Deploying to Railway

1. Sign up at [Railway.app](https://railway.app) using GitHub.
2. Click **New Project** $\rightarrow$ **Deploy from GitHub repo** $\rightarrow$ select `bloodlink`.
3. Add a Database:
   - In the same project canvas, click **New** $\rightarrow$ **Database** $\rightarrow$ **MongoDB**.
   - Railway will provision a private MongoDB container.
4. Railway will automatically link the database connection string as `MONGO_URI` or `DATABASE_URL`.
5. Railway will automatically build and provide a public HTTPS URL.

---

## 🐳 5. Running with Docker Compose (Local & VPS)

To run both the application and a dedicated local `mongod` container in isolation:
```bash
docker-compose up --build
```
The application will be live at `http://localhost:5000` with MongoDB running inside Docker.
