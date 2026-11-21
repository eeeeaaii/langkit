#!/usr/bin/env bash
# Downloads the IPA sample recordings LangKit plays (from Wikimedia Commons)
# into audio/ipa/. Safe to re-run: files already downloaded are skipped.
# Usage, from the repo root:  bash tools/fetch-ipa-audio.sh
set -u
cd "$(dirname "$0")/.."
mkdir -p audio/ipa
UA="LangKit/0.1 (https://github.com/eeeeaaii/langkit)"
total=0; got=0
while read -r name url; do
  [ -z "$name" ] && continue
  total=$((total+1))
  if [ -s "audio/ipa/$name" ]; then got=$((got+1)); continue; fi
  for attempt in 1 2 3 4 5; do
    if curl -sfL -A "$UA" -o "audio/ipa/$name" "$url"; then got=$((got+1)); break; fi
    rm -f "audio/ipa/$name"; sleep $((attempt*3))
  done
  sleep 0.3
done <<'LIST'
Voiceless_bilabial_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/51/Voiceless_bilabial_plosive.ogg/Voiceless_bilabial_plosive.ogg.mp3
Voiced_bilabial_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Voiced_bilabial_plosive.ogg/Voiced_bilabial_plosive.ogg.mp3
Voiceless_alveolar_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/02/Voiceless_alveolar_plosive.ogg/Voiceless_alveolar_plosive.ogg.mp3
Voiced_alveolar_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/01/Voiced_alveolar_plosive.ogg/Voiced_alveolar_plosive.ogg.mp3
Voiceless_retroflex_stop.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b0/Voiceless_retroflex_stop.oga/Voiceless_retroflex_stop.oga.mp3
Voiced_retroflex_stop.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/27/Voiced_retroflex_stop.oga/Voiced_retroflex_stop.oga.mp3
Voiceless_palatal_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5d/Voiceless_palatal_plosive.ogg/Voiceless_palatal_plosive.ogg.mp3
Voiced_palatal_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1d/Voiced_palatal_plosive.ogg/Voiced_palatal_plosive.ogg.mp3
Voiceless_velar_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e3/Voiceless_velar_plosive.ogg/Voiceless_velar_plosive.ogg.mp3
Voiced_velar_plosive_02.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/12/Voiced_velar_plosive_02.ogg/Voiced_velar_plosive_02.ogg.mp3
Voiceless_uvular_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/19/Voiceless_uvular_plosive.ogg/Voiceless_uvular_plosive.ogg.mp3
Voiced_uvular_stop.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b6/Voiced_uvular_stop.oga/Voiced_uvular_stop.oga.mp3
Glottal_stop.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4d/Glottal_stop.ogg/Glottal_stop.ogg.mp3
Bilabial_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a9/Bilabial_nasal.ogg/Bilabial_nasal.ogg.mp3
Labiodental_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/18/Labiodental_nasal.ogg/Labiodental_nasal.ogg.mp3
Alveolar_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/29/Alveolar_nasal.ogg/Alveolar_nasal.ogg.mp3
Retroflex_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/af/Retroflex_nasal.ogg/Retroflex_nasal.ogg.mp3
Palatal_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/46/Palatal_nasal.ogg/Palatal_nasal.ogg.mp3
Velar_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/39/Velar_nasal.ogg/Velar_nasal.ogg.mp3
Uvular_nasal.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3e/Uvular_nasal.ogg/Uvular_nasal.ogg.mp3
Bilabial_trill.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e7/Bilabial_trill.ogg/Bilabial_trill.ogg.mp3
Alveolar_trill.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/ce/Alveolar_trill.ogg/Alveolar_trill.ogg.mp3
Uvular_trill.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cb/Uvular_trill.ogg/Uvular_trill.ogg.mp3
Labiodental_flap.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Labiodental_flap.ogg/Labiodental_flap.ogg.mp3
Alveolar_tap.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a0/Alveolar_tap.ogg/Alveolar_tap.ogg.mp3
Retroflex_flap.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/8/87/Retroflex_flap.ogg/Retroflex_flap.ogg.mp3
Voiceless_bilabial_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/41/Voiceless_bilabial_fricative.ogg/Voiceless_bilabial_fricative.ogg.mp3
Voiced_bilabial_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/37/Voiced_bilabial_fricative.ogg/Voiced_bilabial_fricative.ogg.mp3
Voiceless_labio-dental_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c7/Voiceless_labio-dental_fricative.ogg/Voiceless_labio-dental_fricative.ogg.mp3
Voiced_labio-dental_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/42/Voiced_labio-dental_fricative.ogg/Voiced_labio-dental_fricative.ogg.mp3
Voiceless_dental_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/8/80/Voiceless_dental_fricative.ogg/Voiceless_dental_fricative.ogg.mp3
Voiced_dental_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6a/Voiced_dental_fricative.ogg/Voiced_dental_fricative.ogg.mp3
Voiceless_alveolar_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ac/Voiceless_alveolar_sibilant.ogg/Voiceless_alveolar_sibilant.ogg.mp3
Voiced_alveolar_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Voiced_alveolar_sibilant.ogg/Voiced_alveolar_sibilant.ogg.mp3
Voiceless_palato-alveolar_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cc/Voiceless_palato-alveolar_sibilant.ogg/Voiceless_palato-alveolar_sibilant.ogg.mp3
Voiced_palato-alveolar_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/30/Voiced_palato-alveolar_sibilant.ogg/Voiced_palato-alveolar_sibilant.ogg.mp3
Voiceless_retroflex_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b1/Voiceless_retroflex_sibilant.ogg/Voiceless_retroflex_sibilant.ogg.mp3
Voiced_retroflex_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7f/Voiced_retroflex_sibilant.ogg/Voiced_retroflex_sibilant.ogg.mp3
Voiceless_palatal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/Voiceless_palatal_fricative.ogg/Voiceless_palatal_fricative.ogg.mp3
Voiced_palatal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ac/Voiced_palatal_fricative.ogg/Voiced_palatal_fricative.ogg.mp3
Voiceless_velar_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0f/Voiceless_velar_fricative.ogg/Voiceless_velar_fricative.ogg.mp3
Voiced_velar_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/47/Voiced_velar_fricative.ogg/Voiced_velar_fricative.ogg.mp3
Voiceless_uvular_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c8/Voiceless_uvular_fricative.ogg/Voiceless_uvular_fricative.ogg.mp3
Voiced_uvular_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/af/Voiced_uvular_fricative.ogg/Voiced_uvular_fricative.ogg.mp3
Voiceless_pharyngeal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b2/Voiceless_pharyngeal_fricative.ogg/Voiceless_pharyngeal_fricative.ogg.mp3
Voiced_pharyngeal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cd/Voiced_pharyngeal_fricative.ogg/Voiced_pharyngeal_fricative.ogg.mp3
Voiceless_glottal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/da/Voiceless_glottal_fricative.ogg/Voiceless_glottal_fricative.ogg.mp3
Voiced_glottal_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e2/Voiced_glottal_fricative.ogg/Voiced_glottal_fricative.ogg.mp3
Voiceless_alveolar_lateral_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ea/Voiceless_alveolar_lateral_fricative.ogg/Voiceless_alveolar_lateral_fricative.ogg.mp3
Voiced_alveolar_lateral_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6f/Voiced_alveolar_lateral_fricative.ogg/Voiced_alveolar_lateral_fricative.ogg.mp3
Labiodental_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ee/Labiodental_approximant.ogg/Labiodental_approximant.ogg.mp3
Alveolar_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1f/Alveolar_approximant.ogg/Alveolar_approximant.ogg.mp3
Retroflex_Approximant2.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/bf/Retroflex_Approximant2.oga/Retroflex_Approximant2.oga.mp3
Palatal_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/Palatal_approximant.ogg/Palatal_approximant.ogg.mp3
Voiced_velar_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5c/Voiced_velar_approximant.ogg/Voiced_velar_approximant.ogg.mp3
Alveolar_lateral_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/bc/Alveolar_lateral_approximant.ogg/Alveolar_lateral_approximant.ogg.mp3
Retroflex_lateral_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d1/Retroflex_lateral_approximant.ogg/Retroflex_lateral_approximant.ogg.mp3
Palatal_lateral_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d9/Palatal_lateral_approximant.ogg/Palatal_lateral_approximant.ogg.mp3
Velar_lateral_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d3/Velar_lateral_approximant.ogg/Velar_lateral_approximant.ogg.mp3
Voiceless_labio-velar_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a7/Voiceless_labio-velar_fricative.ogg/Voiceless_labio-velar_fricative.ogg.mp3
Voiced_labio-velar_approximant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f2/Voiced_labio-velar_approximant.ogg/Voiced_labio-velar_approximant.ogg.mp3
LL-Q150__fra_-WikiLucas00-IPA.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/32/LL-Q150_%28fra%29-WikiLucas00-IPA_%C9%A5.wav/LL-Q150_%28fra%29-WikiLucas00-IPA_%C9%A5.wav.mp3
Voiceless_epiglottal_trill.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7b/Voiceless_epiglottal_trill.ogg/Voiceless_epiglottal_trill.ogg.mp3
Voiced_epiglottal_trill_2.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/18/Voiced_epiglottal_trill_2.ogg/Voiced_epiglottal_trill_2.ogg.mp3
Epiglottal_stop.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b2/Epiglottal_stop.ogg/Epiglottal_stop.ogg.mp3
Voiceless_alveolo-palatal_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0b/Voiceless_alveolo-palatal_sibilant.ogg/Voiceless_alveolo-palatal_sibilant.ogg.mp3
Voiced_alveolo-palatal_sibilant.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/15/Voiced_alveolo-palatal_sibilant.ogg/Voiced_alveolo-palatal_sibilant.ogg.mp3
Voiced_alveolar_lateral_flap.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Voiced_alveolar_lateral_flap.wav/Voiced_alveolar_lateral_flap.wav.mp3
Voiceless_dorso-palatal_velar_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/42/Voiceless_dorso-palatal_velar_fricative.ogg/Voiceless_dorso-palatal_velar_fricative.ogg.mp3
Voiceless_palato-alveolar_affricate.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/9/97/Voiceless_palato-alveolar_affricate.ogg/Voiceless_palato-alveolar_affricate.ogg.mp3
Voiced_palato-alveolar_affricate.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e6/Voiced_palato-alveolar_affricate.ogg/Voiced_palato-alveolar_affricate.ogg.mp3
Voiceless_alveolar_sibilant_affricate.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9d/Voiceless_alveolar_sibilant_affricate.oga/Voiceless_alveolar_sibilant_affricate.oga.mp3
Voiced_alveolar_sibilant_affricate.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d8/Voiced_alveolar_sibilant_affricate.oga/Voiced_alveolar_sibilant_affricate.oga.mp3
Clic_bilabial_sourd.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2b/Clic_bilabial_sourd.ogg/Clic_bilabial_sourd.ogg.mp3
Dental_click.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/1/1f/Dental_click.ogg/Dental_click.ogg.mp3
Postalveolar_click.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3c/Postalveolar_click.ogg/Postalveolar_click.ogg.mp3
Palatoalveolar_click.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/8/89/Palatoalveolar_click.ogg/Palatoalveolar_click.ogg.mp3
Alveolar_lateral_click.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/f/f4/Alveolar_lateral_click.ogg/Alveolar_lateral_click.ogg.mp3
Voiced_bilabial_implosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/Voiced_bilabial_implosive.ogg/Voiced_bilabial_implosive.ogg.mp3
Voiced_alveolar_implosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c3/Voiced_alveolar_implosive.ogg/Voiced_alveolar_implosive.ogg.mp3
Voiced_palatal_implosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/2c/Voiced_palatal_implosive.ogg/Voiced_palatal_implosive.ogg.mp3
Voiced_velar_implosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a8/Voiced_velar_implosive.ogg/Voiced_velar_implosive.ogg.mp3
Voiced_uvular_implosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/00/Voiced_uvular_implosive.ogg/Voiced_uvular_implosive.ogg.mp3
Bilabial_ejective_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/64/Bilabial_ejective_plosive.ogg/Bilabial_ejective_plosive.ogg.mp3
Alveolar_ejective_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d7/Alveolar_ejective_plosive.ogg/Alveolar_ejective_plosive.ogg.mp3
Velar_ejective_plosive.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a0/Velar_ejective_plosive.ogg/Velar_ejective_plosive.ogg.mp3
Alveolar_ejective_fricative.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7c/Alveolar_ejective_fricative.ogg/Alveolar_ejective_fricative.ogg.mp3
Close_front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/9/91/Close_front_unrounded_vowel.ogg/Close_front_unrounded_vowel.ogg.mp3
Close_front_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ea/Close_front_rounded_vowel.ogg/Close_front_rounded_vowel.ogg.mp3
Close_central_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/53/Close_central_unrounded_vowel.ogg/Close_central_unrounded_vowel.ogg.mp3
Close_central_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/66/Close_central_rounded_vowel.ogg/Close_central_rounded_vowel.ogg.mp3
Close_back_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e8/Close_back_unrounded_vowel.ogg/Close_back_unrounded_vowel.ogg.mp3
Close_back_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5d/Close_back_rounded_vowel.ogg/Close_back_rounded_vowel.ogg.mp3
Near-close_near-front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4c/Near-close_near-front_unrounded_vowel.ogg/Near-close_near-front_unrounded_vowel.ogg.mp3
Near-close_near-front_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e3/Near-close_near-front_rounded_vowel.ogg/Near-close_near-front_rounded_vowel.ogg.mp3
Near-close_near-back_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d5/Near-close_near-back_rounded_vowel.ogg/Near-close_near-back_rounded_vowel.ogg.mp3
Close-mid_front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/6c/Close-mid_front_unrounded_vowel.ogg/Close-mid_front_unrounded_vowel.ogg.mp3
Close-mid_front_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/5/53/Close-mid_front_rounded_vowel.ogg/Close-mid_front_rounded_vowel.ogg.mp3
Close-mid_central_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/6/60/Close-mid_central_unrounded_vowel.ogg/Close-mid_central_unrounded_vowel.ogg.mp3
Close-mid_central_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/b/b5/Close-mid_central_rounded_vowel.ogg/Close-mid_central_rounded_vowel.ogg.mp3
Close-mid_back_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/26/Close-mid_back_unrounded_vowel.ogg/Close-mid_back_unrounded_vowel.ogg.mp3
Close-mid_back_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/8/84/Close-mid_back_rounded_vowel.ogg/Close-mid_back_rounded_vowel.ogg.mp3
Mid-central_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d9/Mid-central_vowel.ogg/Mid-central_vowel.ogg.mp3
Open-mid_front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/7/71/Open-mid_front_unrounded_vowel.ogg/Open-mid_front_unrounded_vowel.ogg.mp3
Open-mid_front_rounded_vowel__2.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/9/9f/Open-mid_front_rounded_vowel_%282%29.ogg/Open-mid_front_rounded_vowel_%282%29.ogg.mp3
Open-mid_central_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/01/Open-mid_central_unrounded_vowel.ogg/Open-mid_central_unrounded_vowel.ogg.mp3
Open-mid_central_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d9/Open-mid_central_rounded_vowel.ogg/Open-mid_central_rounded_vowel.ogg.mp3
PR-open-mid_back_unrounded_vowel2.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/8/80/PR-open-mid_back_unrounded_vowel2.ogg/PR-open-mid_back_unrounded_vowel2.ogg.mp3
PR-open-mid_back_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/PR-open-mid_back_rounded_vowel.ogg/PR-open-mid_back_rounded_vowel.ogg.mp3
Near-open_front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c9/Near-open_front_unrounded_vowel.ogg/Near-open_front_unrounded_vowel.ogg.mp3
Near-open_central_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Near-open_central_unrounded_vowel.ogg/Near-open_central_unrounded_vowel.ogg.mp3
PR-open_front_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/0/0e/PR-open_front_unrounded_vowel.ogg/PR-open_front_unrounded_vowel.ogg.mp3
Open_front_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c1/Open_front_rounded_vowel.ogg/Open_front_rounded_vowel.ogg.mp3
Open_back_unrounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e5/Open_back_unrounded_vowel.ogg/Open_back_unrounded_vowel.ogg.mp3
PR-open_back_rounded_vowel.mp3 https://upload.wikimedia.org/wikipedia/commons/transcoded/3/31/PR-open_back_rounded_vowel.ogg/PR-open_back_rounded_vowel.ogg.mp3
LIST
echo "Downloaded $got of $total recordings into audio/ipa/"
