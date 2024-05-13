#!/bin/zsh
npm remove sharp
npm install sharp
npm rebuild
npm install
sudo systemctl restart bigreactorsvisualizer