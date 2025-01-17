# RATi Avatar Weaver 0.0.1

RATi Avatar Weaver is a web application that displays a gallery of avatars with pagination support. It uses React, React Query, Tailwind CSS, and Arweave for decentralized storage. The app is designed to work with the ArConnect wallet.

To use this, connect to your database (MongoDB) by setting the options in the .env file. If integrating with another system, consider creating a clone database since data records may be modified. Below is an example of one possible avatar structure:


```interface Avatar {
  _id: ObjectId;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl?: string;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadError?: string | null;
  arweaveUrl?: string | null;
  arweaveMetadataUrl?: string | null;
  ownerAddress?: string;
  updatedAt?: Date; // Tracks last update time
}
```
(see `Avatar.ts`)

## Features

- Display a paginated list of avatars
- Navigate between pages
- Show loading and error states
- Upload avatars to Arweave for decentralized storage

## Technologies Used

- React
- React Query
- Tailwind CSS
- TypeScript
- Arweave

## Arweave Integration

RATi Avatar Weaver uses Arweave to store avatar images and metadata. The upload process involves:
1. Uploading the avatar image to Arweave.
2. Uploading the avatar metadata to Arweave.
3. Checking the transaction status to ensure the data is confirmed on the Arweave network.

The server checks the status of pending uploads periodically and updates the database accordingly.

## Getting Started

### Prerequisites

- Node.js (>=14.x)
- npm or yarn
- MongoDB

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/avatar-weaver.git
   cd avatar-weaver
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Set up environment variables in a `.env` file:
   ```env
   MONGODB_URL=your_mongodb_connection_string
   ```

### Running the Application

1. Start the development server:
   ```bash
   npm start
   # or
   yarn start
   ```
2. Open your browser and navigate to http://localhost:3000.

### Building for Production

To create a production build, run:
```bash
npm run build
# or
yarn build
```
The build output will be in the `build` directory.

## Project Structure

```
/client
  /src
    /components
      AvatarCard.tsx
      ui/button.tsx
    /lib
      types.ts
    /pages
      Home.tsx
    index.css
    index.tsx
  README.md
/server
  worker.ts
  vite.ts
  routes.ts
  index.ts
  utils
    arweave.ts
```

## Known Issues

- Currently, uploads can be slow and expensive due to the cost of Arweave transactions.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Future Improvements

- Explore more efficient transaction bundling or parallel uploads to reduce costs and speed up confirmations.
- Investigate support for alternate decentralized storage solutions or caching layers to optimize performance.
- Implement better support for other systems.
- NFT Metadata Generation and upload.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
