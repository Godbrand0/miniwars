# Deploying the MiniChess Bundler

Since the bundler is a long-running Node.js service that handles blockchain transactions, it is best deployed to a platform that supports persistent web services, like **Render** or **Railway**.

> **Why not Vercel?**
> Vercel is optimized for frontend and serverless functions. Our bundler waits for blockchain transactions to confirm, which can sometimes take longer than the 10-second timeout limit on Vercel's free tier. A persistent server ensures your transactions complete successfully.

## Option 1: Deploy to Render (Recommended)

Render offers a free tier for web services that is perfect for this bundler.

1.  **Push your code to GitHub**
    *   Make sure your `minichess` repo is pushed to GitHub.

2.  **Create a Web Service**
    *   Go to [dashboard.render.com](https://dashboard.render.com/)
    *   Click **New +** -> **Web Service**
    *   Connect your GitHub repository

3.  **Configure the Service**
    *   **Name**: `minichess-bundler`
    *   **Root Directory**: `minichess/bundler` (Important!)
    *   **Runtime**: Node
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
    *   **Instance Type**: Free

4.  **Environment Variables**
    *   Scroll down to "Environment Variables" and add the following from your local `.env`:
        *   `RPC_URL`: `https://forno.celo-sepolia.celo-testnet.org`
        *   `ENTRYPOINT_ADDRESS`: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
        *   `PAYMASTER_ADDRESS`: (Your deployed paymaster address)
        *   `BENEFICIARY_ADDRESS`: (Your wallet address)
        *   `PRIVATE_KEY`: (The private key for the bundler wallet - **use a dedicated wallet with some CELO for gas**)

5.  **Deploy**
    *   Click **Create Web Service**

## Option 2: Deploy to Railway

Railway is another excellent option with a very simple setup.

1.  **Login to Railway**
    *   Go to [railway.app](https://railway.app/)

2.  **New Project**
    *   Click **New Project** -> **Deploy from GitHub repo**
    *   Select your `minichess` repo

3.  **Configure**
    *   Railway usually auto-detects the app. If it tries to deploy the root, go to **Settings** -> **Root Directory** and change it to `minichess/bundler`.
    *   Go to **Variables** and add the same environment variables as above.

4.  **Deploy**
    *   Railway will automatically deploy your app.

## After Deployment

Once deployed, you will get a URL (e.g., `https://minichess-bundler.onrender.com`).

1.  **Update Frontend**
    *   Go to your Vercel project for the frontend.
    *   Update the `NEXT_PUBLIC_BUNDLER_URL` environment variable to your new bundler URL (e.g., `https://minichess-bundler.onrender.com`).
    *   Redeploy the frontend.

## Important Note on Wallet Security

*   **Never use your main wallet's private key** for the bundler.
*   Create a fresh wallet specifically for the bundler.
*   Send a small amount of CELO (e.g., 1-2 CELO) to this new wallet to cover gas fees for submitting transactions.
