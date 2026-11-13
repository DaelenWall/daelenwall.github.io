#!/bin/zsh
cd -- "${0:A:h}"
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 24 --silent
fi
if ! command -v node >/dev/null 2>&1; then
  print 'Install Node.js 24 LTS once, then open this launcher again. See README.md.'
  read '?Press Return to close.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  print 'One-time setup: installing the project dependencies.'
  npm ci || { read '?Installation failed. Press Return to close.'; exit 1; }
fi
npm run studio
read '?The studio has closed. Press Return to close this window.'
