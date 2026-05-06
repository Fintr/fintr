# frozen_string_literal: true

require "rails_helper"

RSpec.describe FailureHandler do
  let(:test_class) do
    Class.new do
      include Dry::Monads::Result::Mixin
      include FailureHandler

      def self.name
        "TestOperation"
      end
    end
  end

  let(:instance) { test_class.new }

  before do
    # Note: binding.pry on line 65 of failure_handler.rb needs to be removed
    # This stub prevents tests from hanging when binding.pry is called
    allow_any_instance_of(Binding).to receive(:pry).and_return(nil)
  end

  describe "#on_failure" do
    context "when failure is a Hash with an error key" do
      let(:test_error) { StandardError.new("Test error message") }
      let(:failure) do
        {
          field_1: "error 1",
          field_2: "error 2",
          error: test_error
        }
      end

      before do
        allow(Rails.logger).to receive(:error)
        allow(Sentry).to receive(:capture_exception)
      end

      context "when expected is false (default)" do
        it "logs the error with Rails logger at error level" do
          instance.on_failure(failure)

          expect(Rails.logger).to have_received(:error).with(
            "[TestOperation] #{{
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              error: test_error
            }}"
          )
        end

        it "captures the exception with Sentry at error level" do
          sentry_scope = instance_double(Sentry::Scope)
          allow(Sentry).to receive(:capture_exception).and_yield(sentry_scope)

          expect(sentry_scope).to receive(:set_tags).with(
            operation: "TestOperation",
            failure_type: "unexpected",
            expected: false
          )
          expect(sentry_scope).to receive(:set_context).with(
            "failure_details",
            {
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              is_expected: false,
              operation_class: "TestOperation"
            }
          )

          instance.on_failure(failure)

          expect(Sentry).to have_received(:capture_exception).with(test_error, level: :error)
        end
      end

      context "when expected is true" do
        let(:failure) do
          {
            field_1: "error 1",
            field_2: "error 2",
            error: test_error,
            expected: true
          }
        end

        before do
          allow(Rails.logger).to receive(:warn)
        end

        it "logs the error with Rails logger at warn level" do
          instance.on_failure(failure)

          expect(Rails.logger).to have_received(:warn).with(
            "[TestOperation] #{{
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              error: test_error
            }}"
          )
        end

        it "captures the exception with Sentry at warning level" do
          sentry_scope = instance_double(Sentry::Scope)
          allow(Sentry).to receive(:capture_exception).and_yield(sentry_scope)

          expect(sentry_scope).to receive(:set_tags).with(
            operation: "TestOperation",
            failure_type: "expected",
            expected: true
          )
          expect(sentry_scope).to receive(:set_context).with(
            "failure_details",
            {
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              is_expected: true,
              operation_class: "TestOperation"
            }
          )

          instance.on_failure(failure)

          expect(Sentry).to have_received(:capture_exception).with(test_error, level: :warning)
        end
      end
    end

    context "when failure does not include an error key but has errors_hash" do
      let(:failure) do
        {
          field_1: "error 1",
          field_2: "error 2"
        }
      end

      before do
        allow(Rails.logger).to receive(:error)
        allow(Sentry).to receive(:capture_exception)
      end

      context "when expected is false (default)" do
        it "logs the error with Rails logger at error level" do
          instance.on_failure(failure)

          expect(Rails.logger).to have_received(:error).with(
            "[TestOperation] #{{
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              error: nil
            }}"
          )
        end

        it "creates and captures OperationFailure exception with Sentry at error level" do
          sentry_scope = instance_double(Sentry::Scope)
          allow(Sentry).to receive(:capture_exception).and_yield(sentry_scope)

          expect(sentry_scope).to receive(:set_tags).with(
            operation: "TestOperation",
            failure_type: "unexpected",
            expected: false
          )
          expect(sentry_scope).to receive(:set_context).with(
            "failure_details",
            {
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              is_expected: false,
              operation_class: "TestOperation"
            }
          )

          instance.on_failure(failure)

          expect(Sentry).to have_received(:capture_exception) do |exception, options|
            expect(exception).to be_a(OperationFailure)
            expect(exception.errors_hash).to eq({
              field_1: "error 1",
              field_2: "error 2"
            })
            expect(exception.operation_class).to eq("TestOperation")
            expect(exception.is_expected).to be false
            expect(options[:level]).to eq(:error)
          end
        end
      end

      context "when expected is true" do
        let(:failure) do
          {
            field_1: "error 1",
            field_2: "error 2",
            expected: true
          }
        end

        before do
          allow(Rails.logger).to receive(:warn)
        end

        it "logs the error with Rails logger at warn level" do
          instance.on_failure(failure)

          expect(Rails.logger).to have_received(:warn).with(
            "[TestOperation] #{{
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              error: nil
            }}"
          )
        end

        it "creates and captures OperationFailure exception with Sentry at warning level" do
          sentry_scope = instance_double(Sentry::Scope)
          allow(Sentry).to receive(:capture_exception).and_yield(sentry_scope)

          expect(sentry_scope).to receive(:set_tags).with(
            operation: "TestOperation",
            failure_type: "expected",
            expected: true
          )
          expect(sentry_scope).to receive(:set_context).with(
            "failure_details",
            {
              errors: {
                field_1: "error 1",
                field_2: "error 2"
              },
              is_expected: true,
              operation_class: "TestOperation"
            }
          )

          instance.on_failure(failure)

          expect(Sentry).to have_received(:capture_exception) do |exception, options|
            expect(exception).to be_a(OperationFailure)
            expect(exception.errors_hash).to eq({
              field_1: "error 1",
              field_2: "error 2"
            })
            expect(exception.operation_class).to eq("TestOperation")
            expect(exception.is_expected).to be true
            expect(options[:level]).to eq(:warning)
          end
        end
      end
    end

    context "when failure is not a Hash" do
      let(:failure) { "string failure" }

      it "raises a NoMatchingPatternError" do
        expect { instance.on_failure(failure) }.to raise_error(NoMatchingPatternError)
      end
    end

    context "when failure has empty errors_hash" do
      let(:failure) do
        {
          error: nil,
          expected: false
        }
      end

      before do
        allow(Rails.logger).to receive(:error)
        allow(Sentry).to receive(:capture_exception)
      end

      it "does not capture exception with Sentry" do
        instance.on_failure(failure)

        expect(Sentry).not_to have_received(:capture_exception)
      end
    end
  end

  describe "#expected_failure" do
    it "returns a Failure monad with expected flag set to true" do
      result = instance.expected_failure({ account_name: "not found" })

      expect(result).to be_a(Dry::Monads::Result::Failure)
      expect(result.failure).to eq({
        account_name: "not found",
        error: nil,
        expected: true
      })
    end

    it "includes error when provided" do
      error = StandardError.new("Test error")
      result = instance.expected_failure({ account_name: "not found" }, error: error)

      expect(result.failure).to eq({
        account_name: "not found",
        error: error,
        expected: true
      })
    end
  end

  describe "#unexpected_failure" do
    it "returns a Failure monad with expected flag set to false" do
      result = instance.unexpected_failure({ operation: "failed" })

      expect(result).to be_a(Dry::Monads::Result::Failure)
      expect(result.failure).to eq({
        operation: "failed",
        error: nil,
        expected: false
      })
    end

    it "includes error when provided" do
      error = StandardError.new("Test error")
      result = instance.unexpected_failure({ operation: "failed" }, error: error)

      expect(result.failure).to eq({
        operation: "failed",
        error: error,
        expected: false
      })
    end
  end

  describe OperationFailure do
  describe "#initialize" do
    it "sets errors_hash, operation_class, and is_expected" do
      errors_hash = { field: "error" }
      operation_class = "TestOperation"
      is_expected = true

      failure = described_class.new(
        errors_hash: errors_hash,
        operation_class: operation_class,
        is_expected: is_expected
      )

      expect(failure.errors_hash).to eq(errors_hash)
      expect(failure.operation_class).to eq(operation_class)
      expect(failure.is_expected).to be true
    end

    it "sets a default message" do
      failure = described_class.new(
        errors_hash: {},
        operation_class: "TestOperation",
        is_expected: false
      )

      expect(failure.message).to eq("Operation Failure: TestOperation")
    end

    context "when backtrace is provided" do
      it "uses the provided backtrace" do
        custom_backtrace = ["line1", "line2", "line3"]
        failure = described_class.new(
          errors_hash: {},
          operation_class: "TestOperation",
          is_expected: false,
          backtrace: custom_backtrace
        )

        expect(failure.backtrace).to eq(custom_backtrace)
      end
    end

    context "when backtrace is not provided" do
      it "captures backtrace from caller" do
        failure = described_class.new(
          errors_hash: {},
          operation_class: "TestOperation",
          is_expected: false
        )

        expect(failure.backtrace).to be_an(Array)
        expect(failure.backtrace).not_to be_empty
      end
    end
  end
end
end
