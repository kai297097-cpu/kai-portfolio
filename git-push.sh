#!/bin/bash

echo "========================================"
echo "Git Push Script - Portfolio Landingpage"
echo "========================================"
echo ""

# Git Status anzeigen
echo "Checking git status..."
git status
echo ""

# Alle Änderungen hinzufügen
echo "Adding all changes..."
git add .
echo ""

# Commit erstellen
echo "Creating commit..."
git commit -m "Update Portfolio: Formsubmit integration, Podcast Player, Design updates"
echo ""

# Zu GitHub pushen
echo "Pushing to GitHub..."
git push origin main
echo ""

echo "========================================"
echo "Done! Check your GitHub Pages:"
echo "https://kai297097-cpu.github.io/kai-portfolio/"
echo "========================================"




