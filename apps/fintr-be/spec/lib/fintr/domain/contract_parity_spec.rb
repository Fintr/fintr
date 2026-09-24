# frozen_string_literal: true

require "json"

RSpec.describe "Fintr domain contract parity (FIN-197)" do
  def fixtures_root
    Rails.root.join("..", "..", "packages", "fintr-domain", "fixtures")
  end

  def load_parity_fixtures(filename)
    JSON.parse(File.read(fixtures_root.join(filename)))
  end

  describe "create transaction fixtures vs Dry::Validation contract" do
    let(:contract) { Transactions::Operations::CreateTransaction::Contract.new }

    it "matches @fintr/domain parity expectations" do
      load_parity_fixtures("create-transaction.parity.json").each do |example|
        result = contract.call(**example.fetch("payload").symbolize_keys)

        if example.fetch("expect_valid")
          expect(result).to be_success, "expected valid: #{example.fetch("name")} => #{result.errors.to_h}"
        else
          expect(result).to be_failure, "expected invalid: #{example.fetch("name")}"
          expected_keys = example.fetch("expected_error_keys")
          expect(result.errors.to_h.keys.map(&:to_s)).to include(*expected_keys)
        end
      end
    end
  end

  describe "create transfer fixtures vs Dry::Validation contract" do
    let(:contract) { Transactions::Operations::Transfers::CreateTransfer::Contract.new }

    it "matches @fintr/domain parity expectations" do
      load_parity_fixtures("create-transfer.parity.json").each do |example|
        result = contract.call(**example.fetch("payload").symbolize_keys)

        if example.fetch("expect_valid")
          expect(result).to be_success, "expected valid: #{example.fetch("name")} => #{result.errors.to_h}"
        else
          expect(result).to be_failure, "expected invalid: #{example.fetch("name")}"
          expected_keys = example.fetch("expected_error_keys")
          expect(result.errors.to_h.keys.map(&:to_s)).to include(*expected_keys)
        end
      end
    end
  end

  describe "repeat interval constants" do
    it "matches the Repeatable concern enum values" do
      expect(Fintr::Domain::Constants::REPEAT_INTERVALS).to match_array(
        Transactions::Transaction.repeat_intervals.values,
      )
    end
  end
end
