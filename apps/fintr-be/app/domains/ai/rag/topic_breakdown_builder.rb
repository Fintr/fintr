# frozen_string_literal: true

module Ai
  module Rag
    # Groups topic-search transactions by merchant/description (not category/subcategory).
    class TopicBreakdownBuilder
      MAX_NAMED_GROUPS = 10
      MAX_GROUPS = MAX_NAMED_GROUPS + 1

      # Single-word prefixes that are too generic to merge unrelated merchants (e.g. Coffee vs Coffee Mate).
      GENERIC_MERCHANT_PREFIXES = Set.new(
        %w[
          coffee
          tea
          food
          drink
          grocery
          mart
          store
          pickup
          pick
          the
          a
          an
        ],
      ).freeze

      class << self
        def build(
          transactions,
          max_groups: MAX_GROUPS
        )
          grouped = Array(transactions).group_by do |transaction|
            normalize_key(description_for(transaction))
          end

          merged = merge_similar_merchants(grouped)

          rows = merged.map do |canonical_key, txns|
            label = canonical_label(
              canonical_key: canonical_key,
              transactions: txns,
            )
            total_cents = txns.sum { |transaction| amount_cents_for(transaction) }

            {
              label: label,
              count: txns.size,
              total_cents: total_cents,
              total: Money.new(total_cents).format
            }
          end.sort_by { |row| -row[:total_cents] }

          collapse_to_others(
            rows,
            max_groups: max_groups,
          )
        end

        def label_for(transaction)
          display_label(description_for(transaction))
        end

        def display_label(description)
          desc = description.to_s.strip
          return "Unknown" if desc.blank?

          desc.titleize
        end

        def normalize_key(description)
          description.to_s.strip.downcase.presence || "unknown"
        end

        def mergeable_prefix?(shorter_key, longer_key)
          return false if shorter_key == longer_key
          return false unless longer_key.start_with?(shorter_key)
          return false unless longer_key == shorter_key || longer_key[shorter_key.length] == " "

          min_length = shorter_key.include?(".") ? 4 : 5
          return false if shorter_key.length < min_length

          first_word = shorter_key.split.first
          return false if GENERIC_MERCHANT_PREFIXES.include?(first_word)
          return false if shorter_key.split.one? && GENERIC_MERCHANT_PREFIXES.include?(shorter_key)

          true
        end

        private

        def merge_similar_merchants(grouped)
          keys = grouped.keys
          return grouped if keys.size < 2

          parent = keys.each_with_index.to_h { |key, index| [index, index] }

          keys.each_with_index do |left_key, left_index|
            keys.each_with_index do |right_key, right_index|
              next if left_index >= right_index
              next unless prefix_pair?(left_key, right_key)

              union!(
                parent: parent,
                left_index: left_index,
                right_index: right_index,
              )
            end
          end

          clusters = Hash.new { |hash, key| hash[key] = [] }

          keys.each_with_index do |key, index|
            root = find_root(
              parent: parent,
              index: index,
            )
            clusters[root] << key
          end

          clusters.each_with_object({}) do |(_root, cluster_keys), merged|
            canonical = cluster_keys.min_by { |key| [key.length, key] }
            merged[canonical] = cluster_keys.flat_map { |key| grouped[key] }
          end
        end

        def prefix_pair?(left_key, right_key)
          if left_key.length <= right_key.length
            mergeable_prefix?(left_key, right_key)
          else
            mergeable_prefix?(right_key, left_key)
          end
        end

        def union!(parent:, left_index:, right_index:)
          left_root = find_root(parent: parent, index: left_index)
          right_root = find_root(parent: parent, index: right_index)
          parent[right_root] = left_root if left_root != right_root
        end

        def find_root(parent:, index:)
          parent[index] == index ? index : parent[index] = find_root(parent: parent, index: parent[index])
        end

        def canonical_label(canonical_key:, transactions:)
          match = transactions.find do |transaction|
            normalize_key(description_for(transaction)) == canonical_key
          end

          display_label(description_for(match || transactions.first))
        end

        def description_for(transaction)
          if transaction.is_a?(Hash)
            transaction[:description]
          else
            transaction.description
          end
        end

        def amount_cents_for(transaction)
          if transaction.is_a?(Hash)
            transaction[:amount_cents]
          else
            transaction.amount_cents
          end
        end

        def collapse_to_others(rows, max_groups:)
          return rows if rows.size <= max_groups

          top_rows = rows.first(max_groups - 1)
          remainder = rows.drop(max_groups - 1)
          others_cents = remainder.sum { |row| row[:total_cents] }
          others_count = remainder.sum { |row| row[:count] }

          top_rows + [
            {
              label: "Others",
              count: others_count,
              total_cents: others_cents,
              total: Money.new(others_cents).format
            }
          ]
        end
      end
    end
  end
end
