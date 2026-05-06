# Creating vs Updating Transactions

Hear me out. Just using my own mental capacity is difficult for this case that I need to consult AI. I'll try to lay down what is happening.

We're creating transactions and there are definitely rules to it.

# Creating Transactions

A transaction is the most atomic record in the Fintr application. It contains data for what the user has spent. It is included in the aggregate reports and all.

A transaction is either an Income or an Expense. The income increases the cash / amount for an Account (which is the record that holds the money for the User). An expense decreases the cash / amount.

A transaction is repeatable. We get to know it's repeatable through the `schedule_type` attribute. If it's `repeat`, then it should have `repeat_interval` and `repeat_count`. The `repeat_interval` is like `every_day`, `every_week`, `every_month`. While the count allows for us to keep track of the transaction. If the schedule type is `installment` then what happens to the `amount` is that it's divided by the amount of the `installment_period` so that the user doesn't have to calculate the amount that it has to give every month. There is a `schedule` that is being created. That is through the ice cube gem, `https://github.com/ice-cube-ruby/ice_cube`, This is being abstracted by the `app/utils/utils/recurrence.rb` file.

With regards to recurrence. We create the `schedule` based on the data we input to the `schedule_type`, `repeat_interval`, and `installment_period`. After creating the schedule. We create the data by doing bulk_import through the `activerecord-import` gem (`https://github.com/zdennis/activerecord-import`). I'm not doing things the rails way wherein I create data singularly. Therefore, I'm definitely experiencing problems with regards to the implementation, as if I need to add additional steps, I will have to make the bulk_import work with the other steps by doing bulk import again. Nevertheless, right now, it seems to be working.

For the recurrence, we also have a concept of `balance_state` wherein it shows whether the `transaction` is already calculated or not. This is used for `repeat` or `installment` transactions because we don't want to show that a `future` transaction is being applied already, right? So, past to present transactions are `:calculated` while the future transactions are `:pending`. This is also important when trying to create repeat transactions.

In terms of `Accounts`, which are records that are holding the money of the user. I understand that it should be increases / decreased depending on whether an income or expense transaction is created. I've definitely created many different code trying to do those calculations instead of just one (not doing DRY for some reason). This is problematic as I want to implement DRY as much as I can. Nevertheless, calculation whenever creating transactions is straightforward, and not very confusing.




# Updating Transactions

The problem I'm facing is that now I need to update the transactions. I'm doing bulk import and I'm having a difficult time to do that. Although, I'm happy with the perfromance of the bulk import.

When updating the transaction and the transaction has a different amount, then we're definitely changing the `account` balance too. When we're doing that, we check for the old `account` and the new `account` that the user assigned. We add (expense) / subtract (income) the old value of the transaction's `amount` to the old `account` then we subtract (expense) / add (income) the new value of the transaction's `amount` to the `new` account. This seems to be easy, but what could we make of the `bulk_import` functionality? It seems that it will be difficult to make use of the `ActiveModel::Dirty` wherein we understand the previous state of the `transaction` and compare it with the current state when we're dealing with `bulk_import`. With `bulk_import`, we simply put our changes, then all that's changed is the transaction. We have to make more code so that the changes of the transaction is reflected to the old `account` and the new `account`. Seems to be a cumbersome task

When we're also changing the `schedule_type` and `repeat_interval` or `installment_period` we're also changing the `schedule`. When we're changing the `schedule` we're also changing the future transactions that were already created. So I guess, it's deleting then creating again. The problem with that is that the we have a concept of a `parent` the `parent` `transaction` holds the data that we create the new `repeat` `transactions` with. Once we're editing/updating, should the `parent transaction` be changed? The upcoming transactions should be using the `edited transaction` as the `parent transaction` instead of that `edit transaction's` parent? I'm definitely not sure what to use for this. Another problem is that if the `user` deletes the first `parent` then the chain of deletion ends to before the last `edited transaction`. So, this may pose a problem for the user, because he will have to delete multiple parents instead of just one. Is this scenario supposed to be thought of?
