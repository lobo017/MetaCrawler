FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o metacrawler-go ./cmd/server

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/metacrawler-go ./metacrawler-go
EXPOSE 8080
CMD ["./metacrawler-go"]
