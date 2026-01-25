#!/bin/bash
set -e

if ! which siege; then
	echo "Install siege first." >&2
	exit 1
fi

SAMPLE_TEMP_FILE="$(mktemp)"
trap "rm \"$SAMPLE_TEMP_FILE\"" EXIT

echo "http://localhost:8080/
http://localhost:8080/apps?page=3
http://localhost:8080/apps?category=browser
http://localhost:8080/apps?type=complex
http://localhost:8080/apps?categoryMode=exclusive&category=emulator&category=games&q=
http://localhost:8080/apps?categoryMode=inclusive&category=2FA&category=ad_blocker&category=anime_and_manga&category=automation&category=barcode_scanner&category=browser&category=calculator&category=calendar&category=camera&category=clock_and_time&category=community_clients&category=dialer&category=document_and_pdf_viewer&category=document_scanner&category=downloader_and_manager&category=drawing&category=email_clients&category=emulator&category=file_manager&category=file_sharing&category=finance&category=games&category=icon_packs&category=image_manipulation&category=image_viewer_and_gallery&category=keyboard&category=launcher_and_desktop&category=maps_and_navigation&category=media_frontends&category=messaging&category=miscellaneous&category=music&category=notes&category=other&category=password_and_authentication&category=podcast_and_audio_book_player&category=privacy_and_anonymity&category=recorder&category=rss_readers&category=sandboxing&category=science_and_education&category=synchronisation&category=system&category=text_editors&category=url_manipulation&category=utilities&category=video_calling&category=video_manipulation&category=video_player&category=vpn&category=wallpapers&category=weather&q=Open
http://localhost:8080/redirect?r=obtainium://add/https://github.com/ImranR98/Obtainium" > "$SAMPLE_TEMP_FILE"

siege -c 10 -t MM --no-follow -f "$SAMPLE_TEMP_FILE"
# cat "$SAMPLE_TEMP_FILE" | while read url; do ab -n 100 -c 10 "$url"; done
