
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    git cmake g++ make python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build Linux Luau executables from source
RUN git clone --depth 1 https://github.com/luau-lang/luau.git /tmp/luau \
    && cmake -S /tmp/luau -B /tmp/luau/build \
       -DCMAKE_BUILD_TYPE=Release \
    && cmake --build /tmp/luau/build \
       --target Luau.Repl.CLI Luau.Ast.CLI -j2 \
    && mkdir -p /app/bin \
    && cp /tmp/luau/build/luau /app/bin/luau \
    && cp /tmp/luau/build/luau-ast /app/bin/luau-ast \
    && chmod +x /app/bin/luau /app/bin/luau-ast \
    && rm -rf /tmp/luau

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PYTHON_BIN=python3

CMD ["node", "bot.js"]
