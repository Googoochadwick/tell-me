# Docker Setup Guide 🐳

This guide helps you run the **Tell-me** extension environment using Docker. This ensures you have all dependencies (Node.js 22, GCC, G++) installed automatically.

## Method 1: The Easy Way (VS Code Dev Containers)

This is the recommended way to develop for this project.

1.  **Install Prerequisites**:
    -   [Docker Desktop](https://www.docker.com/products/docker-desktop/)
    -   VS Code extension: [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2.  **Open Project**:
    -   Open the project folder in VS Code.
3.  **Launch Container**:
    -   VS Code will ask: *"Folder contains a Dev Container configuration file. Reopen to folder to develop in a container?"*
    -   Click **Reopen in Container**.
4.  **Run Extension**:
    -   Wait for the setup to finish.
    -   Press **F5** to start debugging the extension.

---

## Method 2: Manual Docker Build

If you don't use VS Code but want to verify the environment:

1.  **Build the Image**:
    ```bash
    docker build -t tell-me-dev .
    ```
2.  **Run the Container**:
    ```bash
    docker run -it -v $(pwd):/app tell-me-dev
    ```

---

## Important: Local Model Files
The Docker container expects the local model files (tokenizer.json, etc.) to be present in `media/model/` on your host machine. Docker will "mount" this folder so the container can see it.

**Follow the [SETUP_STEPS.md](SETUP_STEPS.md) to download the model if you haven't yet.**
