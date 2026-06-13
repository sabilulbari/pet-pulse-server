````markdown
# 🐾 Pet Pals - Backend Server

The Pet Pals Backend is a RESTful API built with Node.js, Express.js, and MongoDB. It powers the Pet Pals adoption platform by handling authentication, pet management, adoption requests, and secure data operations.

## 🌐 Live API

https://pet-pulse-server.vercel.app/

---

## 🎯 Purpose

This backend server provides secure APIs for:

- User authentication
- Pet management
- Adoption request management
- Dashboard operations
- JWT authorization
- Database interactions

---

## ✨ Features

- Secure JWT Authentication
- HTTPOnly Cookie-based Authorization
- CRUD Operations for Pets
- Adoption Request Management
- Protected Private Routes
- Pet Owner Access Control
- MongoDB Database Integration
- Search and Filter APIs
- Error Handling Middleware
- Environment Variable Security

---

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB Atlas
- Better Auth
- JWT
- Cookie Parser
- CORS
- Dotenv

---

## 📦 NPM Packages Used

```bash
express
mongodb
better-auth
jsonwebtoken
cors
dotenv
cookie-parser
````

---

## 🚀 API Functionalities

### Authentication

* User Registration
* User Login
* Google Authentication
* JWT Token Generation
* HTTPOnly Cookie Storage
* Protected Route Verification

### Pet Management

* Add New Pet
* Get All Pets
* Get Single Pet
* Update Pet
* Delete Pet
* Search Pets
* Filter Pets by Species

### Adoption Requests

* Create Adoption Request
* Get User Requests
* Cancel Request
* Approve Request
* Reject Request
* Prevent Multiple Approved Requests

### Dashboard

* My Listings
* My Requests
* Adoption Request Management

---

## 🔒 Security

* JWT Authentication
* HTTPOnly Cookies
* Environment Variables
* Protected Routes Middleware
* Owner Authorization Check
* MongoDB Credentials Protection

---

## ⚙️ Environment Variables

Create a `.env` file:

```env
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## 📂 Project Structure

```text
server/
│
├── index.js
├── middleware/
├── config/
└── package.json
```

---

## ▶️ Installation

Clone the repository:

```bash
git clone <your-backend-repository-link>
```

Install dependencies:

```bash
npm install
```

Run the server:

```bash
npm run dev
```

---

## 👨‍💻 Developer

**Md Sabilul Bari**

GitHub:
https://github.com/sabilulbari

---

## 📜 License

This project is built for educational and portfolio purposes.

```
```
