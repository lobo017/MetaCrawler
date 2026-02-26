# Contributing to MetaCrawler

Thank you for your interest in contributing to MetaCrawler! 

## Development Workflow

1. **Fork the repository** to your own GitHub account.
2. **Create a feature branch:** ```bash
   git checkout -b feature/your-feature-name```

3. **Commit your changes.** Please use clear, descriptive commit messages.
4. **Push to your branch:** ```bash
git push origin feature/your-feature-name```
5. **Open a Pull Request** against the `main` branch of the upstream repository.

## Coding Standards

* **Testing:** Ensure all new features are accompanied by appropriate unit tests in the respective language (Go, Python, or Node).
* **Formatting:** * Go code should be formatted with `go fmt`.
* Python code should comply with `PEP 8` (we recommend using `black`).
* Node/React code should be formatted via `prettier`.


* **Dependencies:** Do not add heavy dependencies unless thoroughly justified in the Pull Request description.

## Pull Request Process

All Pull Requests must pass the automated GitHub Actions CI pipeline before they can be merged. A maintainer will review your code and may request changes before approval.