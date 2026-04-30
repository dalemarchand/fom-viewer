# Instructions for AI Agents

## Code Quality Requirements

### ALWAYS Run Syntax Check After Edits

After making ANY edits to JavaScript files (`.js`), you MUST run a syntax check before building:

```bash
node --check /home/marchand/src/fom-viewer/src/main.js
```

This will catch syntax errors BEFORE building and deploying.

### Build and Test Cycle

1. After editing `src/main.js` or `src/styles.css`, ALWAYS rebuild:
   ```bash
   cd /home/marchand/src/fom-viewer && npm run build
   ```

2. After building, test the output HTML for syntax errors by checking the built file at:
   - `/home/marchand/src/fom-viewer/fom-viewer.html`
   - `/home/marchand/src/fom-viewer/dist/fom-viewer.html`

### Common Syntax Errors to Watch For

1. **Unterminated comments in state objects** - Be careful with `}` inside comments within JavaScript objects
2. **Missing commas** between object properties
3. **Duplicate code blocks** - When editing functions, ensure you don't leave duplicate code from previous versions
4. **Unmatched braces** - Ensure all `{` and `}` are properly paired
5. **Method vs Function** - When adding a function that needs to be called from multiple methods in a class, add it as a method of the class, not as a standalone function

### Debugging Syntax Errors

If you get a syntax error like:
```
SyntaxError: Unexpected identifier 'xxx' (at file:line:X)
```

Steps to debug:
1. Check the line number mentioned in the error
2. Look for missing commas, unterminated comments, or misplaced code blocks
3. Run `node --check` on the source file to verify the fix
4. Rebuild and test again

### Important Notes

- The HTML file (`fom-viewer.html`) is AUTO-GENERATED from `src/main.js` during build
- NEVER edit `fom-viewer.html` directly - always edit `src/main.js` and rebuild
- Test cases are documented in `docs/appspace-combined.md`
- All appspace features should be tested according to the test cases in the documentation

### Testing After Fixes

After making ANY fix:
1. Run `node --check /home/marchand/src/fom-viewer/src/main.js` to verify syntax
2. Run `cd /home/marchand/src/fom-viewer && npm run build` to rebuild
3. Test in browser with Ctrl+F5 (hard refresh) to clear cache
4. Verify the specific feature that was fixed works correctly

### Testing Parser Changes

When modifying `FOMParser` methods (`parseObjectClasses`, `parseInteractionClasses`, `buildFullName`):
1. ALWAYS run `node --check /home/marchand/src/fom-viewer/src/main.js` after edits
2. Rebuild with `npm run build`
3. Test loading FOM files (including `HLAstandardMIM.xml`)
4. Verify Object Classes tab shows ALL classes (none missing)
5. Verify Interaction Classes tab shows ALL classes (none missing)
6. Check browser console for "buildFullName is not defined" or similar errors
