# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Broadcasts::TransactionChange do
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Food") }
  let(:actor) do
    create(
      :user,
      full_name: "Alex Actor",
      photo_url: "https://example.com/alex.png",
    )
  end
  let!(:expense) do
    create(
      :expense_transaction,
      space:,
      account:,
      category:,
      user: actor,
      amount: Money.from_amount(50, "PHP"),
      date: Date.current,
      description: "Lunch",
    )
  end

  describe ".stream_key" do
    it "uses the space id" do
      expect(described_class.stream_key(space_id: space.id)).to eq(
        "transactions:#{space.id}",
      )
    end
  end

  describe ".created" do
    it "appends to space_change_log and broadcasts sync_change with the index payload and actor" do
      expect do
        described_class.created(transaction: expense, actor:)
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            seq: 1,
            op: "transaction.created",
            spaceId: space.id.to_s,
            payload: hash_including(
              transaction: hash_including(
                id: expense.id,
                description: "Lunch",
                type: "expense",
                categoryId: category.id,
                createdAt: a_string_matching(/\A\d{4}-\d{2}-\d{2}T/),
              ),
            ),
            actor: hash_including(
              userId: actor.id.to_s,
              authId: actor.auth_id.to_s,
              fullName: "Alex Actor",
              photoUrl: "https://example.com/alex.png",
            ),
          ),
        )

      entry = Sync::ChangeLogEntry.find_by!(space_id: space.id, seq: 1)
      expect(entry.op).to eq("transaction.created")
      expect(entry.payload["transaction"]["id"]).to eq(expense.id.to_s)
    end

    it "includes suppressActorToast when requested for series expansion" do
      expect do
        described_class.created(
          transaction: expense,
          actor:,
          suppress_actor_toast: true,
        )
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.created",
          suppressActorToast: true,
        ),
      )
    end

    it "includes originClientMutationId in the ActionCable payload for local-first creates" do
      expect do
        described_class.created(
          transaction: expense,
          actor:,
          origin_client_mutation_id: "cid-local-first-1",
        )
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.created",
          originClientMutationId: "cid-local-first-1",
        ),
      )
    end

    it "persists origin_client_mutation_id on the change log entry" do
      described_class.created(
        transaction: expense,
        actor:,
        origin_client_mutation_id: "cid-local-first-2",
      )

      entry = Sync::ChangeLogEntry.order(:seq).last
      expect(entry.origin_client_mutation_id).to eq("cid-local-first-2")
    end

    it "includes originTabId when Current.client_tab_id is set" do
      Current.client_tab_id = "tab-abc-123"

      expect do
        described_class.created(transaction: expense, actor:)
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.created",
          originTabId: "tab-abc-123",
        ),
      )
    ensure
      Current.reset
    end
  end

  describe ".created_many" do
    let!(:expense_two) do
      create(
        :expense_transaction,
        space:,
        account:,
        category:,
        user: actor,
        amount: Money.from_amount(25, "PHP"),
        date: Date.current + 1.day,
        description: "Snack",
      )
    end

    it "broadcasts one sync_change event with all index payloads" do
      expect do
        described_class.created_many(
          transactions: [expense, expense_two],
          actor:,
          suppress_actor_toast: true,
        )
      end.to have_broadcasted_to("transactions:#{space.id}").exactly(1).times.with(
        hash_including(
          type: "sync_change",
          op: "transaction.created",
          spaceId: space.id.to_s,
          suppressActorToast: true,
          payload: hash_including(
            transactions: [
              hash_including(
                id: expense.id,
                description: "Lunch",
                type: "expense",
              ),
              hash_including(
                id: expense_two.id,
                description: "Snack",
                type: "expense",
              ),
            ],
          ),
          actor: hash_including(
            userId: actor.id.to_s,
            fullName: "Alex Actor",
          ),
        ),
      )
    end
  end

  describe ".updated" do
    it "broadcasts a sync_change transaction.updated event with the index payload and actor" do
      expense.update!(description: "Dinner")

      expect do
        described_class.updated(transaction: expense, actor:)
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.updated",
          spaceId: space.id.to_s,
          payload: hash_including(
            transaction: hash_including(
              id: expense.id,
              description: "Dinner",
              type: "expense",
              categoryId: category.id,
              createdAt: a_string_matching(/\A\d{4}-\d{2}-\d{2}T/),
            ),
          ),
          actor: hash_including(
            userId: actor.id.to_s,
            fullName: "Alex Actor",
          ),
        ),
      )
    end
  end

  describe ".deleted" do
    it "broadcasts a sync_change transaction.deleted event with serialized rows and actor" do
      payload = described_class.serialize_index_row(transaction: expense)

      expect do
        described_class.deleted(
          space_id: space.id,
          transactions: [payload],
          actor:,
        )
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.deleted",
          spaceId: space.id.to_s,
          payload: hash_including(
            transactions: [
              hash_including(
                id: expense.id,
                description: "Lunch",
                type: "expense",
              ),
            ],
          ),
          actor: hash_including(
            userId: actor.id.to_s,
            fullName: "Alex Actor",
          ),
        ),
      )
    end
  end

  describe "loan payment broadcasts" do
    let(:loan) { create(:loan, space:, account:) }
    let!(:loan_payment) { create(:loan_payment, loan:, account:) }

    it "includes loanId on created events" do
      expect do
        described_class.created(transaction: loan_payment, actor:)
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.created",
          payload: hash_including(
            transaction: hash_including(
              id: loan_payment.id.to_s,
              type: "loan_payment",
              loanId: loan.id.to_s,
            ),
          ),
        ),
      )
    end

    it "includes loanId on updated events" do
      expect do
        described_class.updated(transaction: loan_payment, actor:)
      end.to have_broadcasted_to("transactions:#{space.id}").with(
        hash_including(
          type: "sync_change",
          op: "transaction.updated",
          payload: hash_including(
            transaction: hash_including(
              id: loan_payment.id.to_s,
              type: "loan_payment",
              loanId: loan.id.to_s,
            ),
          ),
        ),
      )
    end
  end
end
