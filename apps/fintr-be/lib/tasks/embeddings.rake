# frozen_string_literal: true

namespace :embeddings do
  desc "Generate embeddings for all transactions and transfers that don't have embeddings"
  task generate_missing: :environment do
    puts "🤖 Starting embedding generation for missing records..."

    # Find all transactions without embeddings using subquery
    transaction_ids_with_embeddings = Ai::RagEmbedding
      .where(embeddable_type: "Transactions::Transaction")
      .pluck(:embeddable_id)

    transactions_without_embeddings = Transactions::Transaction
      .where.not(id: transaction_ids_with_embeddings)
      .includes(:category, :account, :space)

    # Find all transfers without embeddings using subquery
    transfer_ids_with_embeddings = Ai::RagEmbedding
      .where(embeddable_type: "Transactions::Transfer")
      .pluck(:embeddable_id)

    transfers_without_embeddings = Transactions::Transfer
      .where.not(id: transfer_ids_with_embeddings)
      .includes(:from_account, :to_account, :space)

    total_records = transactions_without_embeddings.count + transfers_without_embeddings.count

    puts "📊 Found #{transactions_without_embeddings.count} transactions without embeddings"
    puts "📊 Found #{transfers_without_embeddings.count} transfers without embeddings"
    puts "📊 Total records to process: #{total_records}"

    if total_records == 0
      puts "✅ All records already have embeddings!"
      exit 0
    end

    # Enqueue individual embedding jobs for each record
    puts "🚀 Enqueueing individual embedding jobs..."

    # Process transactions
    puts "🔄 Enqueueing transaction embedding jobs..."
    enqueue_embedding_jobs(transactions_without_embeddings)

    # Process transfers
    puts "🔄 Enqueueing transfer embedding jobs..."
    enqueue_embedding_jobs(transfers_without_embeddings)

    puts "✅ All embedding jobs enqueued! Check your job queue for progress."
    puts "💡 Use 'rails embeddings:stats' to monitor progress."
  end

  desc "Generate embeddings for a specific space"
  task :generate_for_space, [:space_id] => :environment do |_task, args|
    space_id = args[:space_id]

    if space_id.blank?
      puts "❌ Error: Please provide a space_id"
      puts "Usage: rails embeddings:generate_for_space[space_id]"
      exit 1
    end

    space = Spaces::Space.find(space_id)
    puts "🤖 Generating embeddings for space: #{space.name} (#{space.id})"

    # Find records for this space without embeddings using subquery
    transaction_ids_with_embeddings = Ai::RagEmbedding
      .where(embeddable_type: "Transactions::Transaction", space_id: space_id)
      .pluck(:embeddable_id)

    transactions_without_embeddings = space.transactions
      .where.not(id: transaction_ids_with_embeddings)
      .includes(:category, :account)

    transfer_ids_with_embeddings = Ai::RagEmbedding
      .where(embeddable_type: "Transactions::Transfer", space_id: space_id)
      .pluck(:embeddable_id)

    transfers_without_embeddings = space.transfers
      .where.not(id: transfer_ids_with_embeddings)
      .includes(:from_account, :to_account)

    total_records = transactions_without_embeddings.count + transfers_without_embeddings.count

    puts "📊 Found #{transactions_without_embeddings.count} transactions without embeddings"
    puts "📊 Found #{transfers_without_embeddings.count} transfers without embeddings"
    puts "📊 Total records to process: #{total_records}"

    if total_records == 0
      puts "✅ All records in this space already have embeddings!"
      exit 0
    end

    # Enqueue individual embedding jobs for each record
    puts "🚀 Enqueueing individual embedding jobs..."

    # Process transactions
    puts "🔄 Enqueueing transaction embedding jobs..."
    enqueue_embedding_jobs(transactions_without_embeddings)

    # Process transfers
    puts "🔄 Enqueueing transfer embedding jobs..."
    enqueue_embedding_jobs(transfers_without_embeddings)

    puts "✅ All embedding jobs enqueued for space: #{space.name}!"
    puts "💡 Use 'rails embeddings:stats' to monitor progress."
  end

  desc "Delete and recreate all embeddings for all spaces belonging to one or more user emails"
  task :recreate_for_email, [:emails] => :environment do |_task, args|
    emails = parse_recreate_emails(args[:emails])

    if emails.empty?
      puts "❌ Error: Please provide at least one email"
      puts "Usage: rails embeddings:recreate_for_email[email1@example.com,email2@example.com]"
      puts "   or: EMAILS=email1@example.com,email2@example.com rails embeddings:recreate_for_email"
      exit 1
    end

    puts "🔄 Recreating embeddings for #{emails.count} #{'email'.pluralize(emails.count)}"

    missing_emails = []
    processed_space_ids = []

    emails.each do |email|
      normalized_email = Auth::User.normalize_email_for_lookup(email)
      user = Auth::User.find_by(email: normalized_email)

      if user.nil?
        missing_emails << normalized_email
        puts "⚠️  No user found with email #{normalized_email}"
        next
      end

      spaces = user.spaces
      puts ""
      puts "👤 #{user.email} (#{spaces.count} #{'space'.pluralize(spaces.count)})"

      if spaces.empty?
        puts "✅ User has no spaces."
        next
      end

      spaces.find_each do |space|
        next if processed_space_ids.include?(space.id)

        processed_space_ids << space.id
        recreate_embeddings_for_space(space)
      end
    end

    puts ""
    if missing_emails.any?
      puts "⚠️  Skipped #{missing_emails.count} unknown #{'email'.pluralize(missing_emails.count)}: #{missing_emails.join(', ')}"
    end

    puts "✅ All embedding jobs enqueued for #{processed_space_ids.count} #{'space'.pluralize(processed_space_ids.count)}!"
    puts "💡 Use 'rails embeddings:stats' to monitor progress."
  end

  desc "Regenerate all embeddings (delete existing and create new ones)"
  task regenerate_all: :environment do
    puts "🔄 Regenerating all embeddings..."

    # Delete all existing embeddings
    deleted_count = Ai::RagEmbedding.count
    Ai::RagEmbedding.delete_all
    puts "🗑️  Deleted #{deleted_count} existing embeddings"

    # Generate new embeddings for all records
    Rake::Task["embeddings:generate_missing"].invoke
  end

  desc "Show embedding statistics"
  task stats: :environment do
    puts "📊 Embedding Statistics"
    puts "=" * 50

    total_embeddings = Ai::RagEmbedding.count
    transaction_embeddings = Ai::RagEmbedding.where(embeddable_type: "Transactions::Transaction").count
    transfer_embeddings = Ai::RagEmbedding.where(embeddable_type: "Transactions::Transfer").count

    total_transactions = Transactions::Transaction.count
    total_transfers = Transactions::Transfer.count

    puts "Total Embeddings: #{total_embeddings}"
    puts "  - Transaction embeddings: #{transaction_embeddings}"
    puts "  - Transfer embeddings: #{transfer_embeddings}"
    puts ""
    puts "Coverage:"
    puts "  - Transactions: #{transaction_embeddings}/#{total_transactions} (#{percentage(transaction_embeddings, total_transactions)}%)"
    puts "  - Transfers: #{transfer_embeddings}/#{total_transfers} (#{percentage(transfer_embeddings, total_transfers)}%)"
    puts ""

    # Show by space
    puts "By Space:"
    Spaces::Space.includes(:transactions, :transfers).each do |space|
      space_transactions = Ai::RagEmbedding.where(embeddable_type: "Transactions::Transaction", space_id: space.id).count
      space_transfers = Ai::RagEmbedding.where(embeddable_type: "Transactions::Transfer", space_id: space.id).count
      total_space_records = space.transactions.count + space.transfers.count
      total_space_embeddings = space_transactions + space_transfers

      puts "  - #{space.name}: #{total_space_embeddings}/#{total_space_records} (#{percentage(total_space_embeddings, total_space_records)}%)"
    end
  end

  desc "Clean up orphaned embeddings (embeddings for deleted records)"
  task cleanup_orphaned: :environment do
    puts "🧹 Cleaning up orphaned embeddings..."

    # Find embeddings for non-existent records
    orphaned_embeddings = Ai::RagEmbedding.where.not(
      embeddable_type: "Transactions::Transaction",
      embeddable_id: Transactions::Transaction.pluck(:id)
    ).or(
      Ai::RagEmbedding.where.not(
        embeddable_type: "Transactions::Transfer",
        embeddable_id: Transactions::Transfer.pluck(:id)
      )
    )
    orphaned_count = orphaned_embeddings.count

    if orphaned_count > 0
      puts "🗑️  Found #{orphaned_count} orphaned embeddings"
      orphaned_embeddings.delete_all
      puts "✅ Cleaned up #{orphaned_count} orphaned embeddings"
    else
      puts "✅ No orphaned embeddings found"
    end
  end

  desc "Monitor embedding job queue status"
  task queue_status: :environment do
    puts "📊 Embedding Job Queue Status"
    puts "=" * 50

    # Check SolidQueue status
    if defined?(SolidQueue)
      pending_jobs = SolidQueue::Job.where(queue_name: "ai_processing").count
      failed_jobs = SolidQueue::Job.where(queue_name: "ai_processing", finished_at: nil, failed_at: nil).count

      puts "Queue: ai_processing"
      puts "  - Pending jobs: #{pending_jobs}"
      puts "  - Failed jobs: #{failed_jobs}"
    else
      puts "⚠️  SolidQueue not available - using ActiveJob"

      # Fallback to ActiveJob queue
      if defined?(ActiveJob::QueueAdapters::SolidQueueAdapter)
        puts "Queue: ai_processing (via ActiveJob)"
      else
        puts "⚠️  No queue adapter configured"
      end
    end

    puts ""
    puts "💡 Use 'rails embeddings:stats' to see embedding coverage"
    puts "💡 Use 'rails embeddings:generate_missing' to start processing"
  end

  private

  def parse_recreate_emails(emails_arg)
    raw = emails_arg.presence || ENV.fetch("EMAILS", nil)
    return [] if raw.blank?

    raw.split(",").map { |email| email.strip }.reject(&:blank?).uniq
  end

  def recreate_embeddings_for_space(space)
    puts ""
    puts "🔄 Space: #{space.name} (#{space.id})"

    deleted_count = Ai::RagEmbedding.where(space_id: space.id).delete_all
    puts "🗑️  Deleted #{deleted_count} existing embeddings"

    transactions = space.transactions.includes(:category, :account, :subcategory)
    transfers = space.transfers.includes(:from_account, :to_account)
    total_records = transactions.count + transfers.count

    puts "📊 Found #{transactions.count} transactions"
    puts "📊 Found #{transfers.count} transfers"
    puts "📊 Total records to process: #{total_records}"

    if total_records.zero?
      puts "✅ No transactions or transfers in this space."
      return
    end

    puts "🚀 Enqueueing individual embedding jobs..."

    puts "🔄 Enqueueing transaction embedding jobs..."
    enqueue_embedding_jobs(transactions)

    puts "🔄 Enqueueing transfer embedding jobs..."
    enqueue_embedding_jobs(transfers)

    puts "✅ Embedding jobs enqueued for space: #{space.name}"
  end

  def enqueue_embedding_jobs(records)
    success_count = 0
    error_count = 0

    records.find_each(batch_size: 100) do |record|
      begin
        # Enqueue individual embedding generation job
        Ai::Embeddings::GenerateEmbeddingJob.perform_later(
          embeddable_id: record.id,
          embeddable_type: record.class.name,
          space_id: record.space_id
        )

        success_count += 1
        print "." if success_count % 10 == 0
      rescue => e
        error_count += 1
        print "E"
        puts "\n❌ Error enqueueing job for #{record.class.name} #{record.id}: #{e.message}"
      end
    end

    puts "\n✅ Jobs enqueued: #{success_count} successful, #{error_count} failed"
  end

  def percentage(part, total)
    return 0 if total == 0
    ((part.to_f / total) * 100).round(1)
  end
end
