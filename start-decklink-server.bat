@echo off
:: DeckLink Server - Silent Auto-Start Script
:: This script starts the DeckLink PC server in the background.
:: Place a shortcut to this file in shell:startup to auto-run on boot.

cd /d "D:\All Projects\My_Elgato_Steam_deck\decklink-server"
start /min "" npm start
