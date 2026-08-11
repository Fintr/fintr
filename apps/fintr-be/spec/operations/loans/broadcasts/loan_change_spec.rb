# frozen_string_literal: true

require "rails_helper"

RSpec.describe Loans::Broadcasts::LoanChange do
  let(:space) { create(:personal_space) }
  let(:actor) do
    create(
      :user,
      full_name: "Alex Actor",
      photo_url: "https://example.com/alex.png",
    )
  end
  let(:loan) { create(:loan, space:) }
  let(:loan_payment) { create(:loan_payment, loan:) }

  describe ".stream_key" do
    it "uses the transactions stream for the space" do
      expect(described_class.stream_key(space_id: space.id)).to eq(
        "transactions:#{space.id}",
      )
    end
  end

  describe ".loan_created" do
    it "appends to space_change_log and broadcasts sync_change with loan payload" do
      expect do
        described_class.loan_created(loan:, actor:)
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            seq: 1,
            op: "loan.created",
            spaceId: space.id.to_s,
            payload: hash_including(
              loan: hash_including(
                id: loan.id,
                loanType: loan.loan_type,
              ),
            ),
            actor: hash_including(
              userId: actor.id.to_s,
              authId: actor.auth_id.to_s,
            ),
          ),
        )
    end
  end

  describe ".loan_deleted" do
    it "broadcasts loan.deleted with loan id payload" do
      expect do
        described_class.loan_deleted(
          loan_id: loan.id,
          space_id: space.id,
          actor:,
        )
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            op: "loan.deleted",
            payload: hash_including(loanId: loan.id.to_s),
          ),
        )
    end
  end

  describe ".loan_payment_created" do
    it "broadcasts loan_payment.created with payment payload" do
      expect do
        described_class.loan_payment_created(loan_payment:, actor:)
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            op: "loan_payment.created",
            payload: hash_including(
              loanPayment: hash_including(
                id: loan_payment.id,
                loanId: loan.id,
              ),
            ),
          ),
        )
    end
  end

  describe ".loan_payment_deleted" do
    it "broadcasts loan_payment.deleted with ids payload" do
      expect do
        described_class.loan_payment_deleted(
          loan_payment_id: loan_payment.id,
          loan_id: loan.id,
          space_id: space.id,
          actor:,
        )
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            op: "loan_payment.deleted",
            payload: hash_including(
              loanPaymentId: loan_payment.id.to_s,
              loanId: loan.id.to_s,
            ),
          ),
        )
    end
  end
end
