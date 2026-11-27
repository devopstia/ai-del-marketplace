# Install AWS Load Balancer Controller using HELM

# Resource: Helm Release 
resource "helm_release" "loadbalancer_controller" {
  depends_on = [aws_iam_role.aws-load-balancer-controller]
  name       = "aws-load-balancer-controller"
  # https://github.com/aws/eks-charts/tree/master/stable
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"

  namespace = var.aws-load-balancer-controller-ns
  set = [
    {
      name  = "image.repository"
      value = "602401143452.dkr.ecr.us-east-1.amazonaws.com/amazon/aws-load-balancer-controller" # Changes based on Region - This is for us-east-1 Additional Reference: https://docs.aws.amazon.com/eks/latest/userguide/add-ons-images.html
    },
    {
      name  = "serviceAccount.create"
      value = "true"
    },
    {
      name  = "serviceAccount.name"
      value = var.aws-load-balancer-controller-sa
    },
    {
      name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = aws_iam_role.aws-load-balancer-controller.arn
    },
    {
      name  = "vpcId"
      value = var.vpc_id
    },
    {
      name  = "region"
      value = var.aws_region
    },
    {
      name  = "clusterName"
      value = data.aws_eks_cluster.example.name
    }
  ]

}
