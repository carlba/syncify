SHELL := /bin/zsh

.PHONY: latest-sample-config

latest-sample-config:
	@mkdir -p ~/.config/syncify
	@cp config.yml.example ~/.config/syncify/config.yml
	@echo "Deployed sample config to ~/.config/syncify/config.yml"
