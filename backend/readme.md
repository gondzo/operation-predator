# Tc heatmap backend

# requirements
* nodejs v6

# configurations
Copy the serverless.env.sample.yml file as serverless.env.yml and fill in your aws credential details

# deployment to AWS

1. `npm i`
2. `serverless deploy`

# verification

Once the project is deployed to AWS (and connected to an instance of ElasticSearch), you can force index data by navigating to the aws lambda url and fetching the /force_index.

For generating the heatmap results, simply fetch https://yourawsfunction.com/search with an optional parameter of 'date' being in 'MM-DD-YYYY' format (such as 1-15-2018)!

Optionally you can use the postman collection provided as an alternative means of verification.

Note: for verifying retry, you can simply point to an invalid Elastic search cluster and you can watch the job be retried three times.