# FerFieFam Dashboard

A family finance management dashboard built with Next.js, TypeScript, Wagmi, Prisma, and Recharts. Parents and children can manage chores, allowances, and view token price charts in real-time.

## Features

- **Parent Authentication** via Ethereum wallet (Wagmi).
- **Child Authentication** via session token.
- **Chore Management**: Assign and track chores with due dates.
- **Allowance Tracking**: View and manage stable balance using ERC-20 contracts.
- **Price Charts**: Interactive 24-hour price graphs with trend indicators.
- **NFT Dashboard**: View 7-day volume and last sales in family currency.
- **Responsive UI** with Tailwind CSS.

## Tech Stack

- Next.js (App Router)
- React & TypeScript
- Wagmi & Viem for Ethereum interactions
- Prisma ORM with PostgreSQL
- Recharts for data visualization
- Tailwind CSS & Radix UI components
- QR Code login via `html5-qrcode`

## Getting Started

### Prerequisites

- Node.js >= 18
- Yarn, npm, or pnpm
- PostgreSQL database
- Ethereum wallet (MetaMask, Coinbase Wallet, etc.)

### Setup

1. Clone the repo:
   ```bash
   git clone
   cd ferfiefam
   ```
2. Install dependencies:
   ```bash
   npm install
   # or yarn
   ```
3. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your DATABASE_URL, NEXT_PUBLIC_RPC_URL, COOKIE_SECRET, etc.
   ```
4. Generate Prisma client and run migrations:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
5. Run development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000)

## Available Scripts

- `npm run dev` – Start development server.
- `npm run build` – Build for production.
- `npm start` – Start production server.
- `npm run lint` – Run Next.js lint.
- `npm run format` – Format code with Prettier.

## Environment Variables

| Name                 | Description                                   |
| -------------------- | --------------------------------------------- |
| DATABASE_URL         | PostgreSQL connection string                  |
| NEXT_PUBLIC_RPC_URL  | Ethereum JSON-RPC endpoint                    |
| PUBLIC_RESERVOIR_API_KEY  | Nft functionality                   |
| OPENSEA_API_KEY  | Nft functionality                   |
| NEXT_PUBLIC_ONCHAINKIT_API_KEY    | Connect the app to the OnchainKit              |
| KMS_KEY_ID           | Google Cloud KMS key for secure operations    |
--Check example env for all

## Project Structure

```
/ferfiefam
├── src
│   ├── components      # Shared UI components
│   ├── contexts        # React contexts (Auth, Role)
│   ├── lib             # Utilities (tokens, utils)
│   ├── pages/app       # Next.js App Router files
│   └── server          # API & server-side logic
├── prisma              # Schema and migrations
├── public              # Static assets
└── README.md
```

## Deployment

Deploy easily on Vercel:
```bash
vercel --prod
```

Or see [Next.js deployment docs](https://nextjs.org/docs/deployment).

## Contributing

1. Fork the repo & create a branch.
2. Write tests and code.
3. Submit a pull request.

## License

MIT © Free for everyone to use :)
