FROM golang:1.23.3-alpine3.19
WORKDIR /app

# Copy and download dependencies first (improves build caching)
COPY go.mod ./
RUN go mod tidy

# Copy the rest of the app
COPY . .

RUN go build -o main .
CMD ["./main"]
