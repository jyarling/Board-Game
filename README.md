# Board Game Example

This repository contains a basic multiplayer board game framework built with Node.js, Express and Socket.IO. Players join through their browser and take turns rolling two dice to move around a 20-space board. It is intended as a starting point for creating more complex board game mechanics.

## Requirements

- [Node.js](https://nodejs.org/) (version 18 or later)
- npm (comes with Node.js)

## Installation

1. Clone this repository or download the source code.
2. From the project root, install dependencies:
   ```bash
   npm install
   ```

## Running the Game

Start the server with:
```bash
npm start
```
The server listens on port **3000** by default. You can specify a different port by setting the `PORT` environment variable before running the command.

Open `http://localhost:3000` in one or more browsers (or devices) to play. Each browser session represents a player.

## Playing

1. Enter a name in the input box and click **Join Game**. Up to four players may join at once.
2. When it's your turn, the **Roll Dice** button becomes active. Each roll uses two six‑sided dice and your token moves forward the combined total.
3. Everyone's current board position is displayed on the board.
4. After your turn, the next player is automatically notified.

## Project Structure

- `server.js` – sets up the Express server and WebSocket logic for turn management.
- `public/index.html` – simple user interface for joining and rolling dice.
- `public/script.js` – client-side code that communicates with the server via Socket.IO.

The UI uses a responsive grid layout so the board adjusts to different screen sizes.

Feel free to extend this code to build out your own custom board game rules.
