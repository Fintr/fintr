# frozen_string_literal: true

namespace :jobs do
  desc "Check job queue status"
  task status: :environment do
    puts "=" * 80
    puts "📊 SolidQueue Job Status"
    puts "=" * 80

    if defined?(SolidQueue::Job)
      # Check pending jobs
      pending = SolidQueue::Job.where(finished_at: nil).where("scheduled_at IS NULL OR scheduled_at <= ?", Time.current)
      puts "\n📋 Pending Jobs: #{pending.count}"
      pending.limit(10).each do |job|
        puts "  - ID: #{job.id}, Class: #{job.class_name}, Queue: #{job.queue_name}, Created: #{job.created_at}"
      end

      # Check failed jobs
      failed = SolidQueue::FailedExecution.joins(:job)
      puts "\n❌ Failed Jobs: #{failed.count}"
      failed.limit(10).each do |execution|
        puts "  - Job ID: #{execution.job_id}, Error: #{execution.error&.first(100)}"
      end

      # Check running jobs
      claimed = SolidQueue::ClaimedExecution.joins(:job)
      puts "\n🔄 Running Jobs: #{claimed.count}"
      claimed.limit(10).each do |execution|
        puts "  - Job ID: #{execution.job_id}, Process ID: #{execution.process_id}"
      end

      # Check processes
      processes = SolidQueue::Process.where(kind: "Worker")
      puts "\n👷 Active Workers: #{processes.count}"
      processes.each do |process|
        puts "  - Name: #{process.name}, PID: #{process.pid}, Last Heartbeat: #{process.last_heartbeat_at}"
      end
    else
      puts "⚠️  SolidQueue not available"
    end

    puts "\n" + "=" * 80
  end

  desc "Test job enqueueing"
  task test: :environment do
    puts "Testing job enqueueing..."
    job = ::Ai::AiChatJob.perform_later(
      "test-session-#{Time.current.to_i}",
      "test query",
      1,
      1,
      nil
    )
    puts "Job enqueued: #{job.job_id}"
    puts "Check status with: rails jobs:status"
  end
end
