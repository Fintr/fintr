We're going to create a tutorial for our users. When the user is in the dashboard. We should show a dashboard with fake data on them. Then have highlights on the places that the user needs to click. Let's not allow them to click on anything else except for that highlighted button. Can we do that?

I think we should make our tutorial short. 

We just show the creation of the transaction (show expense, income, transaction), add receipt, and loans.

We should also show the dashboard for the insights.

For the transaction, here are the steps.

For the backend, we should have 2 fields, desktop_tutorial, and mobile_tutorial. When the user is on a desktop, the frontend checks for this on the User's field. The values for these are datetimes, these will get populated when the user has finished the tutorial. The frontend checks for these values for the user to know whether it will show the tutorial or not.

When the user is in the dashboard after the set up,
1. Darken everything else like in a modal backdrop. Only show the `Create Transaction` Button (Website), or the `+` button that goes to the create transaction in the mobile. Allow the user to click on them.
2. Show the other options for the user to use. Highlight the Expense, Income, Transfer, and Loan in the transaction.
3. Allow the user to create the transaction, the tutorial should tell them.
4. Highlight the `Add Expense` button for the user to click.
5. We get directed to the transactions and we highlight that transaction in the transactions list, saying these are the details being used.
6. We then show the income, highlight the `deduct taxes` and `deduct contributions` checkbox pills. Mention that the values used are as if we're getting the income for a year.
7. Let the user create the income transaction and let him click on the `Add Income` button.
9. We get directed to the transactions and we highlight that income transaction in the transactions list and show that this is what we're getting for the income.
10. For the Transfer, we should be going to the, we just show the form and explain that this is being used if we're transfering money from one account to another.
11. We go immediately to Loans. We go to the Loan page in mobile and website. In here we try to explain that we can keep track of people loaning from us or when we loan from other people. We can see the interests we lose / gain per month. Let the user fill the blanks, but we ensure that the interest rate is 10% and the loan term (months) is 12 months. We get them to fill it up and let them click on the `Create Loan` button. 
12. We show the Loans page, click on it and show the loan schedule for the user to see.
13. We let him click on `Add Payment` and let him fill up that with the payment amount and let him click on `Record payment`.
14. We show the loan and that the loan schedule is changed.
15. We go to the `Add Receipt` functionality. We get the user to click through the ubttons, for the mobile it's the `+` sign then click on `Add Receipt`. For the browser, we click on the `Add Receipt` on the top. We just explain that the user should just put their receipt's image then we read on these and enter the data based on the receipt.
16. We end the tutorial.


Take note that the tutorial for the desktop should be different from the tutorial for the mobile. Make use of Cursor's browser to understand which parts of the application should be handled.
