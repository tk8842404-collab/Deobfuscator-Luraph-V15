FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    git \
    cmake \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 https://github.com/luau-lang/luau.git /tmp/luau \
    && cmake -S /tmp/luau -B /tmp/luau/build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/luau/build --target Luau.Repl.CLI Luau.Analyze.CLI -j2 \
    && mkdir -p /app/bin \
    && cp /tmp/luau/build/luau /app/bin/luau \
    && cp /tmp/luau/build/luau-analyze /app/bin/luau-analyze \
    && rm -rf /tmp/luau

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PYTHON_BIN=python3

CMD ["node", "bot.js"]
