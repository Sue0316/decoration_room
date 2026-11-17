# Room Studio

Plan a room in 2D and 3D, rebuild a room from a photo, and brainstorm design directions with Claude.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173. No API key is needed: the Photo to 3D and Ideas tabs give you a prompt to paste into your Claude chat, and you paste the reply back.

Optional: to skip the copy and paste, copy `.env.example` to `.env`, add an `ANTHROPIC_API_KEY`, and restart. The tabs then call the API directly, and each request is billed to that key.

For a production-style run: `npm run build`, then `npm start`, and open http://localhost:8787.

## Features

- **Room map:** set a rectangle or L-shape, drag corners, and drag the dot on a wall to add a corner. Walls show their lengths.
- **Furniture:** 38 pieces, including a U-shaped sofa, a fireplace, heater, floor-length window, stairs, vases, round tables and five kinds of rug. Click or drag to add, then move, rotate, resize and recolour. Doors, windows and art snap to walls. Pieces that overlap or cross a wall are flagged.
- **Walls and floor:** with nothing selected, pick a finish (tile, mosaic, brick, wood panel, planks, parquet, carpet and more) and a colour. Tiles are drawn at real size.
- **Rooms:** create, name, copy and switch between rooms from the top bar. Every room saves automatically in this browser. **Export** downloads the current room as a `.room.json` file and **Import** opens one as a new room, for backups or another computer. `plans/living-room.room.json` is a ready-made living room with a bay window and fireplace, and `plans/living-room-clean-luxury.room.json` is the same room furnished in a clean luxury style.
- **3D view:** updates live. Orbit with the mouse and drag furniture across the floor. Walls facing the camera hide themselves.
- **Photo to 3D:** upload a whole room or a single piece of furniture. Claude estimates dimensions, positions and colours, and the app rebuilds them from its own editable shapes.
- **Ideas:** three design concepts based on your actual room, with palettes you can apply and pieces you can add.

The 3D result is an editable approximation built from stock shapes. It is not a photogrammetric scan, so it won't reproduce the exact look of your furniture, and a single photo can't give exact measurements. Entering a known width improves the scale.

## Layout

- `src/` React UI. `components/Plan2D.tsx` is the map, `components/Scene3D.tsx` the three.js view, `furniture3d.ts` the furniture models.
- `server/index.ts` Express API; the only code that holds the API key.
- `shared/schemas.ts` Zod schemas for AI responses, shared by client and server.
