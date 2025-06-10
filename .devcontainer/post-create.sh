#!/bin/bash

echo "🚀 Setting up Smart Help Desk PIO development environment..."

# Install dependencies
echo "📦 Installing backend dependencies..."
cd /workspaces/*/backend
npm install

echo "📦 Installing frontend dependencies..."
cd /workspaces/*/frontend
npm install

# Set up database
echo "🗄️ Setting up database..."
cd /workspaces/*/backend
cp .env.example .env 2>/dev/null || echo "⚠️ .env.example not found, skipping..."
npx prisma generate
npx prisma migrate dev --name init || echo "⚠️ Database migration skipped"

# Install Claude Code
echo "🤖 Installing Claude Code..."
npm install -g @anthropic-ai/claude-code

# Create startup script
echo "📝 Creating startup script..."
cat > /workspaces/*/start-dev.sh << 'EOF'
#!/bin/bash
echo "Starting Smart Help Desk PIO..."

# Start backend
echo "Starting backend server..."
cd /workspaces/*/backend
npm run dev &

# Wait for backend to start
sleep 5

# Start frontend
echo "Starting frontend server..."
cd /workspaces/*/frontend
npm run dev &

echo "✅ Application started!"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5173"
EOF

chmod +x /workspaces/*/start-dev.sh

echo "✅ Development environment setup complete!"
echo "Run './start-dev.sh' to start the application" 