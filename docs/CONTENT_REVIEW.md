# Content review guide (for the physics teacher)

All LearnLoop content is a **seeded draft** written for this prototype. Nothing claims a textbook citation. Every
item, card and misconception carries `TODO_VERIFY` until a teacher has checked it.

## Where to review

- In the app: footer → **For teachers** → reviewer token → **Content review**. Each question shows its answer key,
  which idea each wrong option maps to, the working, and any specific doubts the authors flagged.
- As a list: `python scripts/validate_content.py --table` prints every question with its answer and codes.
- Source files: `data/content/<concept>_items.json` (questions) and `data/content/<concept>_cards.json` (lesson card,
  remediation cards, student phrasings, contrast questions, common doubts).

## What to check

1. **Answers and working**: every numeric answer and its `calc` line; options that are "SLIP" must be the result of a
   genuine careless step (forgotten square root, sign, unit).
2. **Sign conventions**: lens and mirror formulas use the Cartesian convention (1/v − 1/u = 1/f, m = v/u for lenses).
   Confirm against the Maharashtra State Board HSC textbook.
3. **Misconceptions**: each wrong option and wrong reason must reveal the named idea, not a random error. The 20 codes
   are listed in `data/misconceptions.json`.
4. **Short answers**: the `accept_any`, `reasoning_any` and `patterns` phrase lists decide free-text grading. Check that
   a correct answer cannot accidentally contain a misconception phrase (the validator checks exact overlaps; the
   test `test_every_short_item_accepts_its_own_model_answer` checks each model answer grades as correct).
5. **Language**: student phrasings include Hinglish; please check they sound natural. Marathi is handled by the voice
   agent's translation.
6. **Overlay setups**: items with a `setup` (refractive indices, angles, lens distances) drive the "your idea vs
   physics" drawings; the numbers must match the question.

## Marking something verified

Edit the file, remove `TODO_VERIFY` from that item's or card's `verify_flags` (keep any note that still applies), then:

```bash
python scripts/load_content.py     # rebuilds data/*.json and re-validates everything
python -m pytest                   # all tests must still pass
```

The learning page then labels the card "reviewed by a teacher" instead of "draft, awaiting teacher review".
