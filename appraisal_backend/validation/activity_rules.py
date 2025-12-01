#Total Number of Activities = 7
#Total Number of Activies teacher participated in : User Input

def activity_score(activites_participated):
    if activites_participated >= 3:
        return 'good'
    elif 1 < activites_participated < 2:
        return 'satisfactory'
    else:
        return 'not satisfactory'

