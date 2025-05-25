---
description: 
globs: 
alwaysApply: true
---
## Introduction
We're creating spec files using this playbook. What we're doing is making sure every part of the code is well-tested so that we can ensure that the code is working correctly.

## Input

1. LOCATION - this is where the file is located. Its specs are similar to the to the location it has. This file will be the main file and the one that is going to be created the specs for.

## Steps

1. Look at the location and check the file.
2. Look for the spec file corresponding to that file.
3. If there is already a file, check the difference of that file. To check the difference. Use the terminal and write `git diff <relative_location>`. Use these differences to understand what changes you may need to make to the spec file for that file.
4. If there is no file, create the specs based on best practices that you know. If there are many spec files around the location or any similar files, check those files too. It's best to read 3 files when you're doing this so that you understand what is the style and format of the specs.
5. Test the spec. Run `bundle exec rspec <location>`
6. If it succeeds, end your session.
7. If it fails, review the errors and make the necessary changes to pass the tests. Do not make changes to the file. Only make changes to the spec file instead. Then do step 5.


## Considerations
1. Controllers - If it's a controller like `app/controllers/api/v1/budgets_controller.rb`, you should do request specs instead of controller specs. Consider the established in `.cursor/rules/specs/request_specs.mdc`.
